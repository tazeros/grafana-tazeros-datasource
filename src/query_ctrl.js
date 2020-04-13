import {
     QueryCtrl
} from 'grafana/app/plugins/sdk';

export class TazerosDatasourceQueryCtrl extends QueryCtrl {

     constructor($scope, $injector) {
          super($scope, $injector);

          this.target.type = this.target.type || 'timeserie';
          this.target.token = this.target.token || null;
          this.target.message = this.target.message || "Insert token!";

          this.loaded = false;
          this.error = false;

     }
     tokenSave(){
          if(this.target.token != null){
               this.datasource.request("auto", "vizs", "data", "aggregate", {grafana:{maxDataPoints:0}, token:this.target.token}).then((response) => {
                    if(response.state == 200){
                         this.target.message = response.message;
                    }else{
                         this.target.message = response.message;
                    }
                    this.$scope.$digest();
                    this.panelCtrl.refresh();
               }).catch((reason) => {
                    this.target.message = "Unfortunately, we were unable to establish a connection!";
                    this.$scope.$digest();
               });    
          }
     }
     getOptions(query){
          return this.datasource.metricFindQuery(query || '');
     }
     toggleEditorMode(){
          this.target.rawQuery = !this.target.rawQuery;
     }
     onChangeInternal(){
          this.panelCtrl.refresh();
     }
}

TazerosDatasourceQueryCtrl.templateUrl = 'partials/query.html';