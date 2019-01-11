import _ from "lodash";
import * as CryptoJS from 'crypto-js';

export class TazerosDatasource {

     constructor(instanceSettings, $q, backendSrv, templateSrv) {
          this.type = instanceSettings.type;
          this.name = instanceSettings.name;
          this.token = instanceSettings.jsonData.token;
          this.encrypt_handshakes = {};
          this.encrypt_tokens = {};
          this.q = $q;
          this.backendSrv = backendSrv;
          this.templateSrv = templateSrv;
     }

     query(options) {

          var query = this.buildQueryParameters(options);
          query.targets = query.targets.filter(t => !t.hide);

          if (query.targets.length <= 0) {
               return this.q.when({data: []});
          }

          if(this.templateSrv.getAdhocFilters) {
               query.adhocFilters = this.templateSrv.getAdhocFilters(this.name);
          }else{
               query.adhocFilters = [];
          }

          var targets_by_api = {};
          var promises = [];
          for (var i = 0; i < query.targets.length; i++) {
               if (targets_by_api[query.targets[i].api_handler] == undefined) targets_by_api[query.targets[i].api_handler] = [];
               targets_by_api[query.targets[i].api_handler].push(query.targets[i]);
          }
          Object.keys(targets_by_api).forEach((api_handler) => {
               promises.push(this.request(api_handler, "grafana", "raw", "query", {
                    data: {
                         maxDataPoints: query.maxDataPoints,
                         range: query.range,
                         targets: targets_by_api[api_handler]
                    }
               }));
          });
          return new Promise((resolve, reject) => {
               Promise.all(promises).then((responses) => {
                    var data = [];
                    for (var _i = 0; _i < responses.length; _i++) {
                         if (responses[_i].state != undefined && responses[_i].state == 200 && responses[_i].data != undefined) {
                              for (var j = 0; j < responses[_i].data.length; j++) {
                                   data.push(responses[_i].data[j]);
                              }
                         }
                    }
                    resolve({
                         data: data
                    });
               }).catch((reason) => {
                    reject(reason);
               });
          });
     }

     testDatasource() {
          return this.request(1, "user", "auth", "token_check", {}).then((response) => {
               if (response.state === 200 && response.data.id != undefined) {
                    return {
                         status: "success",
                         message: response.data.first_name + ", congratulations! Connection with this token was successfully established.",
                         title: "Success"
                    };
               } else {
                    return {
                         status: "error",
                         message: "Unfortunately, we were unable to establish a connection with this token.",
                         title: "Error"
                    };
               }
          });
     }

     annotationQuery(options) {
          var query = this.templateSrv.replace(options.annotation.query, {}, 'glob');
          var annotationQuery = {
               range: options.range,
               annotation: {
                    name: options.annotation.name,
                    datasource: options.annotation.datasource,
                    enable: options.annotation.enable,
                    iconColor: options.annotation.iconColor,
                    query: query
               },
               rangeRaw: options.rangeRaw
          };

          return this.doRequest({
               url: this.url + '/annotations',
               method: 'POST',
               data: annotationQuery
          }).then(result => {
               return result.data;
          });
     }

     metricFindQuery(query) {
          var interpolated = {
               target: this.templateSrv.replace(query, null, 'regex')
          };

          return this.doRequest({
               url: this.url + '/search',
               data: interpolated,
               method: 'POST',
          }).then(this.mapToTextValue);
     }

     mapToTextValue(result) {
          return _.map(result.data, function(d, i) {
               if (d && d.text && d.value) {
                    return {
                         text: d.text,
                         value: d.value
                    };
               } else if (_.isObject(d)) {
                    return {
                         text: d,
                         value: i
                    };
               }
               return {
                    text: d,
                    value: d
               };
          });
     }

     doRequest(options) {
          options.withCredentials = this.withCredentials;
          options.headers = this.headers;

          return this.backendSrv.datasourceRequest(options);
     }

     buildQueryParameters(options) {
          var targets = _.filter(options.targets, (target) => {
               return !(!target.database || !target.collection || !target.metrics);
          });
          var targets = _.map(targets, (target) => {
               return {
                    refId: target.refId,
                    database: target.database,
                    collection: target.collection,
                    metrics: target.metrics,
                    aggregation: target.aggregation,
                    api_handler: target.api_handler,
                    hide: target.hide || false,
                    type: target.type || 'timeserie'
               };
          });
          options.targets = targets;
          return options;
     }

     request(api_handler, module, controller, method, attributes) {
          if (api_handler < 10) api_handler = "0" + api_handler;
          if (this.encrypt_handshakes[api_handler] == undefined) {
               return new Promise((resolve, reject) => {
                    this.xhr("GET", "https://api" + api_handler + ".tazeros.com", "").then((response) => {
                         if (response.encrypt.handshake != undefined) {

                              this.encrypt_handshakes[api_handler] = response.encrypt.handshake;
                              this.encrypt_tokens[api_handler] = response.encrypt.token;

                              resolve(this.requestSecure(api_handler, module, controller, method, attributes));
                         }
                    }).catch((reason) => {
                         reject(reason);
                    });
               });
          } else {
               return this.requestSecure(api_handler, module, controller, method, attributes);
          }
     }

     requestSecure(api_handler, module, controller, method, attributes) {
          return new Promise((resolve, reject) => {
               this.xhr("POST", "https://api" + api_handler + ".tazeros.com/" + module + "/" + controller + "/" + method, CryptoJS.AES.encrypt("module=" + module + "&controller=" + controller + "&method=" + method + "&attributes=" + encodeURIComponent(JSON.stringify(attributes)) + "&cache=0&token=" + this.token, this.encrypt_handshakes[api_handler]).toString() + "|" + this.encrypt_tokens[api_handler]).then((response) => {
                    if (response.state === 200 && response.response.state === 200) {
                         resolve(response.response);
                    } else {
                         reject("Tazeros API error. Check your token.");
                    }
               }).catch((reason) => {
                    reject(reason);
               });
          });
     }
     xhr(method, url, data) {
          return new Promise((resolve, reject) => {
               var xhr = new XMLHttpRequest();
               xhr.open(method, url);
               xhr.onload = function() {
                    if (this.status >= 200 && this.status < 300) {
                         try {
                              resolve(JSON.parse(xhr.responseText));
                         } catch (e) {
                              reject("Tazeros API internal error.");
                         }
                    } else {
                         reject("Tazeros API internal error.");
                    }
               };
               xhr.onerror = function() {
                    reject("Tazeros API internal error.");
               };
               xhr.send(data);
          });
     }

}