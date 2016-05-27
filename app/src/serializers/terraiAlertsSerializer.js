'use strict';

var logger = require('logger');
var JSONAPISerializer = require('jsonapi-serializer').Serializer;
var terraiAlertsSerializer = new JSONAPISerializer('terrai-alerts', {
    attributes: ['value', 'period'],
    typeForAttribute: function (attribute, record) {
        return attribute;
    },
    keyForAttribute: 'camelCase'
});

class TerraiAlertsSerializer {

  static serialize(data) {
    return terraiAlertsSerializer.serialize(data);
  }
}

module.exports = TerraiAlertsSerializer;
