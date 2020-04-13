import _ from "lodash";

export class TazerosDatasource {

     constructor(instanceSettings, $q, backendSrv, templateSrv) {
          this.type = instanceSettings.type;
          this.name = instanceSettings.name;
          this.token = null;
          this.q = $q;
          this.backendSrv = backendSrv;
          this.templateSrv = templateSrv;
          this.api_handler = null;
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

          let promises = [];
          for (let i = 0; i < query.targets.length; i++) {
               promises.push(this.request("auto", "vizs", "data", "aggregate", {
                    token:query.targets[i].token,
                    grafana:{
                         maxDataPoints: query.maxDataPoints,
                         range: query.range,
                         target: query.targets[i]
                    }
               }));
          }
          
          return new Promise((resolve, reject) => {
               Promise.all(promises).then((responses) => {
                    
                    let data = [];
                    for (let i = 0; i < responses.length; i++) {
                         if (responses[i] != null && responses[i].state != undefined && responses[i].state == 200 && responses[i].data != undefined) {
                              
                              for(let j = 0; j < responses[i].data.length; j++){
                                   
                                   data.push({
                                        target:responses[i].data[j].target,
                                        datapoints:responses[i].data[j].datapoints
                                   });
                                   
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
          return this.request("auto", "user", "auth", "check", {}).then((user_response) => {
               if(user_response.state != undefined){
                    return {
                         status: "success",
                         message: "Congratulations, connection was successfully established!",
                         title: "Success"
                    };
               }else{
                    return {
                         status: "error",
                         message: "Unfortunately, we were unable to establish a connection!",
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
                    database: options.annotation.database,
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
               return !(!target.token);
          });
          var targets = _.map(targets, (target) => {
               return {
                    refId: target.refId,
                    token: target.token,
                    hide: target.hide || false,
                    type: target.type || 'timeserie'
               };
          });
          options.targets = targets;
          return options;
     }

     request(api_handler, module, controller, method, attributes) {
          let _this = this;
          let xhr_promise = function(api_handler, token){
               return new Promise((resolve, reject) => {
                    var xhr = new XMLHttpRequest();
                    xhr.withCredentials = false;
                    xhr.open("POST", api_handler.trim("/") + "/" + module + "/" + controller + "/" + method);
                    xhr.onload = function() {
                         if (this.status >= 200 && this.status < 300) {
                              try {
                                   let response = JSON.parse(xhr.responseText);
                                   resolve(response.response);
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
                    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
                    xhr.send("module=" + module + "&controller=" + controller + "&method=" + method + "&token="+token+"&attributes=" + encodeURIComponent(JSON.stringify(attributes)));
               });
          };
          if(api_handler == "auto"){
               if(_this.api_handler == null){
                    return new Promise((resolve, reject) => {
                         var xhr = new XMLHttpRequest();
                         xhr.open("GET", "https://api.tazeros.com");
                         xhr.onload = function() {
                              if (this.status == 200) {
                                   try {
                                        let response = JSON.parse(xhr.responseText);
                                        if(response.api_host != undefined){
                                             _this.api_handler = response.api_host;
                                             resolve(xhr_promise(_this.api_handler, _this.token));
                                        }else{
                                             reject();
                                        }
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
                         xhr.send();
                    });
               }else{
                    return xhr_promise(_this.api_handler, _this.token);
               }
          }else{
               return xhr_promise(api_handler, _this.token);
          }
     }

}