import {
     QueryCtrl
} from 'grafana/app/plugins/sdk';

export class TazerosDatasourceQueryCtrl extends QueryCtrl {

     constructor($scope, $injector) {
          super($scope, $injector);

          this.target.type = this.target.type || 'timeserie';
          this.target.api_handler = this.target.api_handler || 1;
          this.target.database = this.target.database || false;
          this.target.collection = this.target.collection || false;
          this.target.metrics = this.target.metrics || false;
          this.target.aggregation = this.target.aggregation || "avg";

          this.loaded = false;
          this.error = false;
          this.databases = [];
          this.collections = [];
          this.metrics = [];
          this.aggregations = [{
               "key": "avg",
               "name": "AVG"
          }, {
               "key": "sum",
               "name": "SUM"
          }, {
               "key": "min",
               "name": "MIN"
          }, {
               "key": "max",
               "name": "MAX"
          }, {
               "key": "first",
               "name": "FIRST"
          }, {
               "key": "last",
               "name": "LAST"
          }, {
               "key": "stdDevSamp",
               "name": "STD Sample"
          }, {
               "key": "stdDevPop",
               "name": "STD Population"
          }];

     }
     link(obj) {
          this.datasource.request(1, "grafana", "datasources", "get", {}).then((response) => {
               if (response.state == 200) {
                    this.databases = response.data.databases;
                    this.collections = response.data.collections;
                    this.metrics = response.data.metrics;

                    this.loaded = true;
                    this.$scope.$digest();
               }
          }).catch((reason) => {
               this.error = true;
               this.$scope.$digest();
          });
     }
     databaseChange() {
          this.panelCtrl.refresh();
     }
     collectionChange() {
          this.panelCtrl.refresh();
     }
     metricsChange() {
          for (var i = 0; i < this.metrics.length; i++) {
               if (this.metrics[i].database == this.target.database && this.metrics[i].collection == this.target.collection && this.metrics[i].key == this.target.metrics) {
                    this.target.api_handler = this.metrics[i].api_handler;
                    this.target.type = this.metrics[i].type;
                    this.target.aggregation_need = this.metrics[i].aggregation_need;
               }
          }
          this.panelCtrl.refresh();
     }
     aggregationChange() {
          this.panelCtrl.refresh();
     }
     getOptions(query) {
          return this.datasource.metricFindQuery(query || '');
     }

     toggleEditorMode() {
          this.target.rawQuery = !this.target.rawQuery;
     }

     onChangeInternal() {
          this.panelCtrl.refresh();
     }
}

TazerosDatasourceQueryCtrl.templateUrl = 'partials/query.html';