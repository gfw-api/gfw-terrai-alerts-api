'use strict';

var logger = require('logger');
var JSONAPISerializer = require('jsonapi-serializer').Serializer;
var terraiAlertsSerializer = new JSONAPISerializer('terrai-alerts', {
    attributes: ['value', 'period', 'min_date', 'max_date','downloadUrls'],
    typeForAttribute: function (attribute, record) {
        return attribute;
    },
    downloadUrls:{
        attributes: ['csv', 'geojson', 'kml', 'shp', 'svg']
    }
});

class TerraiAlertsSerializer {

  static serialize(data) {
    return terraiAlertsSerializer.serialize(data);
  }
}

module.exports = TerraiAlertsSerializer;
