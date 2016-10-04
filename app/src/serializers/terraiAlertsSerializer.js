'use strict';

var logger = require('logger');
var JSONAPISerializer = require('jsonapi-serializer').Serializer;
var terraiAlertsSerializer = new JSONAPISerializer('terrai-alerts', {
    attributes: ['value', 'period', 'minDate', 'maxDate', 'downloadUrls', 'areaHa'],
    typeForAttribute: function(attribute, record) {
        return attribute;
    },
    downloadUrls: {
        attributes: ['csv', 'geojson', 'kml', 'shp', 'svg']
    },
    keyForAttribute: 'camelCase'
});

let years = [];
let maxYear = new Date().getFullYear();
for(let i = 2004; i <= maxYear; i++ ){
    years.push(i + '');
}

var terraiAlertsLatestSerializer = new JSONAPISerializer('terrai-latest', {
    attributes: ['minDate', 'maxDate', 'counts'],
    typeForAttribute: function(attribute, record) {
        return attribute;
    },
    counts:{
        attributes: years
    },
    keyForAttribute: 'camelCase'
});

class TerraiAlertsSerializer {

    static serialize(data) {
        return terraiAlertsSerializer.serialize(data);
    }
    static serializeLatest(data) {
        return terraiAlertsLatestSerializer.serialize(data);
    }
}

module.exports = TerraiAlertsSerializer;
