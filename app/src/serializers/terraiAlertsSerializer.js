'use strict';

var logger = require('logger');
var JSONAPISerializer = require('jsonapi-serializer').Serializer;
var terraiAlertsSerializer = new JSONAPISerializer('terrai-alerts', {
    attributes: ['value', 'period', 'min_date', 'max_date', 'downloadUrls'],
    typeForAttribute: function(attribute, record) {
        return attribute;
    },
    downloadUrls: {
        attributes: ['csv', 'geojson', 'kml', 'shp', 'svg']
    }
});

var terraiAlertsLatestSerializer = new JSONAPISerializer('terrai-latest', {
    attributes: ['grid_code', 'date'],
    typeForAttribute: function(attribute, record) {
        return attribute;
    }
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
