Ext.define("workitem-throughput", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',itemId:'message_box',tpl:'Hello, <tpl>{_refObjectName}</tpl>'},
        {xtype:'container',itemId:'display_box'}
    ],

    integrationHeaders : {
        name : "workitem-throughput"
    },

    config: {
        defaultSettings: {
            throughputMeasure: 'PlanEstimate',
            timeboxGranularity: 'week',
            numberTimeboxes: 6,
            artifactModels: ['Defect','UserStory']
        }
    },

    launch: function() {
        this.updateDisplay();
    },
    updateDisplay: function(){
        this.setLoading(true);
        this.fetchWsapiArtifactRecords({
            models: this.getArtifactModels(),
            limit: Infinity,
            fetch: this.getArtifactFetch(),
            filters: this.getArtifactFilters()
        }).then({
            success: this.buildChart,
            failure: this.showErrorNotification,
            scope: this
        }).always(function(){ this.setLoading(false);}, this);
    },
    buildChart: function(records){
        this.logger.log('buildChart', records);
        var numTimeboxes = this.getSetting('numberTimeboxes'),
            timeboxGranularity = this.getSetting('timeboxGranularity');

        var userStories = Ext.Array.filter(records, function(r){ return r.get('_type') === 'hierarchicalrequirement'; }),
            userStoryData = RallyTechServices.workItemThroughput.utils.FlowCalculator.getBucketData(timeboxGranularity,numTimeboxes,userStories,this.getThroughputMeasure(),'AcceptedDate');

        var defects = Ext.Array.filter(records, function(r){ return r.get('_type') === 'defect'; }),
            defectData = RallyTechServices.workItemThroughput.utils.FlowCalculator.getBucketData(timeboxGranularity,numTimeboxes, defects,this.getThroughputMeasure(),'AcceptedDate');

        /**
         * catagories: [week1, week2, ...]
         * series: [{
         *      name: 'User Story',
         *      data: []
         * },{
         *      name: 'Defect',
         *      data: []
         * }]
         */

        var series = [{
            name: 'User Story',
            data: userStoryData
        },{
            name: 'Defect',
            data: defectData
        }];

        var categories = RallyTechServices.workItemThroughput.utils.FlowCalculator.getFormattedBuckets(timeboxGranularity,numTimeboxes);

        if (this.down('rallychart')){
            this.down('rallychart').destroy();
        }

        this.add({
            xtype:'rallychart',
            chartConfig: this.getChartConfig(),
            chartData: {
                series: series,
                categories: categories
            }
        });


    },
    getChartConfig: function(){
        return {
            chart: {
                type: 'column'
            },
            title: {
                text: this.getChartTitle(),
                style: {
                    color: '#666',
                    fontSize: '18px',
                    fontFamily: 'ProximaNova',
                    textTransform: 'uppercase',
                    fill: '#666'
                }
            },
            subtitle: {
                text: this.getSubtitle()
            },

            xAxis: {
                title: {
                    text: null,
                    style: {
                        color: '#444',
                        fontFamily: 'ProximaNova',
                        textTransform: 'uppercase',
                        fill: '#444'
                    }
                },
                labels: {
                    style: {
                        color: '#444',
                        fontFamily: 'ProximaNova',
                        fill: '#444'
                    }
                }
            },
            yAxis: {
                min: 0,
                title: {
                    text: this.getSubtitle(),
                    style: {
                        color: '#444',
                        fontFamily: 'ProximaNova',
                        textTransform: 'uppercase',
                        fill: '#444'
                    }
                },
                labels: {
                    overflow: 'justify',
                    style: {
                        color: '#444',
                        fontFamily: 'ProximaNova',
                        fill: '#444'
                    }
                }
            },
            tooltip: {
                valueSuffix: this.getValueSuffix(),
                backgroundColor: '#444',
                useHTML: true,
                borderColor: '#444',
                style: {
                    color: '#FFF',
                    fontFamily: 'ProximaNova',
                    fill: '#444'
                }
            },
            plotOptions: {
                column: {
                    stacking: 'normal'
                }
            },
            legend: {
                itemStyle: {
                    color: '#444',
                    fontFamily: 'ProximaNova',
                    textTransform: 'uppercase'
                },
                borderWidth: 0
            }
        };
    },
    getValueSuffix: function(){
        var throughputMeasure = Ext.Array.filter(this.getThroughputMeasureData(), function(g){ return g.value === this.getThroughputMeasure(); }, this);

        if (!throughputMeasure || throughputMeasure.length === 0){
            return " Work Items";
        }
        return throughputMeasure[0].suffix;

    },
    getSubtitle: function(){
        var throughputMeasure = Ext.Array.filter(this.getThroughputMeasureData(), function(g){ return g.value === this.getThroughputMeasure(); }, this);

        if (!throughputMeasure || throughputMeasure.length === 0){
            return "Count of Work Items";
        }
        return Ext.String.format("Sum of {0}", throughputMeasure[0] && throughputMeasure[0].name);
    },
    getChartTitle: function(){
        var timebox = Ext.Array.filter(this.getGranularityData(), function(g){ return g.value === this.getTimeboxGranularity(); }, this);

        return Ext.String.format("{0} Throughput", timebox[0] && timebox[0].name);
    },
    showErrorNotification: function(msg){
        Rally.ui.notify.Notifier.showError({
            message: msg,
            allowHTML: true
        });
    },
    getArtifactModels: function(){
        return this.getSetting('artifactModels');
    },
    getArtifactFetch: function(){
        return ['ObjectID','AcceptedDate','DirectChildrenCount', this.getThroughputMeasure()];
    },
    getArtifactFilters: function(){
        var numTimeboxes = this.getSetting('numberTimeboxes'),
            timeboxGranularity = this.getTimeboxGranularity();

        var startDate = RallyTechServices.workItemThroughput.utils.FlowCalculator.getStartDateBoundary(timeboxGranularity,numTimeboxes);

        return [{
            property: 'AcceptedDate',
            operator: '>=',
            value: Rally.util.DateTime.toIsoString(startDate)
        }];
    },
    getThroughputMeasure: function(){
        return this.getSetting('throughputMeasure');
    },
    getTimeboxGranularity: function(){
        return this.getSetting('timeboxGranularity');
    },
    fetchWsapiArtifactRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');

        if (!config.limit){ config.limit = "Infinity"; }
        if (!config.pageSize){ config.pageSize = 2000; }
        Ext.create('Rally.data.wsapi.artifact.Store',config).load({
            callback: function(records, operation){
                if (operation.wasSuccessful()){
                    deferred.resolve(records);
                } else {
                    deferred.reject('Error fetching artifact records: ' + operation.error && operation.error.errors.join('<br/>'));
                }
            }
        });

        return deferred.promise;
    },
    getThroughputMeasureData: function(){
        //summable fields on the Schedulable Artifact
        return [{
            name: 'Plan Estimate',
            value: 'PlanEstimate',
            suffix: ' Points'
        },{
            name: 'Task Actual Total',
            value: 'TaskActualTotal',
            suffix: ' Hours'
        },{
            name: 'Task Estimate Total',
            value: 'TaskEstimateTotal',
            suffix: ' Hours'
        }];
    },
    getGranularityData: function(){
        return [{
            name: 'Weekly',
            value: 'week'
        },{
            name: 'Monthly',
            value: 'month'
        },{
            name: 'Quarterly',
            value: 'quarter'
        }];
    },
    getSettingsFields: function(){

        return [{
            xtype: 'rallycombobox',
            fieldLabel: 'Throughput Measure',
            labelAlign: 'right',
            name: 'throughputMeasure',
            store:  Ext.create('Rally.data.custom.Store', {
                data: this.getThroughputMeasureData(),
                fields: ['name','value']
            }),
            allowNoEntry: true,
            noEntryText: 'Count',
            displayField: 'name',
            valueField: 'value'
        },{
            xtype: 'rallycombobox',
            fieldLabel: 'Timebox Granularity',
            labelAlign: 'right',
            name: 'timeboxGranularity',
            store: Ext.create('Rally.data.custom.Store', {
                data: this.getGranularityData(),
                fields: ['name', 'value']
            }),
            allowNoEntry: false,
            displayField: 'name',
            valueField: 'value'
        },{
            xtype: 'rallynumberfield',
            fieldLabel: '# Timeboxes',
            labelAlign: 'right',
            name: 'numberTimeboxes',
            minValue: 1,
            maxValue: 52
        }];
    },
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    }
    
});