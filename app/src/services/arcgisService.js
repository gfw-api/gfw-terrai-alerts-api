'use strict';
var logger = require('logger');
var config = require('config');
var coRequest = require('co-request');
var CartoDB = require('cartodb');
var CartoDBService = require('services/cartoDBService');
const ArcgisError = require('errors/arcgisError');
const querystring = require('querystring');

const IMAGE_SERVER = 'http://gis-gfw.wri.org/arcgis/rest/services/image_services/terrai_analysis/ImageServer/';
const START_YEAR = 2004;
const MOSAIC_RULE = {
    'mosaicMethod': 'esriMosaicLockRaster',
    'ascending': true,
    'mosaicOperation': 'MT_FIRST'
};


class ArcgisService {
    static generateMosaicrule(raster) {
        let mosaicrule = Object.assign({}, MOSAIC_RULE, {
            lockRasterIds: [5]
        });
        return mosaicrule;
    }

    static geojsonToEsriJson(geojson) {
        if (geojson.type === 'Polygon') {
            geojson.rings = geojson.coordinates;
            delete geojson.coordinates;
        } else if (geojson.type === 'MultiPolygon') {
            geojson.rings = geojson.coordinates[0];
            delete geojson.coordinates;
        }
        geojson.type = 'polygon';
        return geojson;
    }

    static getYearDay(date) {
        var start = new Date(Date.UTC(date.getFullYear(), 0, 0));
        var diff = date - start;
        var oneDay = 1000 * 60 * 60 * 24;
        var dayOfYear = Math.floor(diff / oneDay);
        return dayOfYear;
    }

    static dateToGridCode(date) {
        return ArcgisService.getYearDay(date) + (365 * (date.getFullYear() - START_YEAR));
    }



    static * getHistogram(esriJSON) {
        let formFields = {
            geometry: JSON.stringify(esriJSON),
            geometryType: 'esriGeometryPolygon',
            f: 'pjson'
        };

        let imageServer = IMAGE_SERVER;

        let results = {};

        formFields.mosaicRule = JSON.stringify(ArcgisService.generateMosaicrule());
        logger.debug('Doing request to arcgis with url ', `${imageServer}computeHistograms`, 'and formfields', querystring.stringify(formFields));
        let result = yield coRequest({
            uri: `${imageServer}computeHistograms`,
            method: 'POST',
            form: querystring.stringify(formFields),
            json: true
        });

        if (result.statusCode === 200 && !result.body.error) {
            logger.debug('Response OK. body: ');
            results = result.body;
        } else  {
            logger.error('Error to obtain data in arcgis');
            if (result.body.error.code === 400 || result.body.error.code === 500 || result.statusCode === 500) {
                throw new ArcgisError('The area you have selected is quite large and cannot be analyzed on-the-fly. Please select a smaller area and try again.');
            } else {
                throw new ArcgisError('Error obtaining data in Arcgis');
            }
        }

        logger.debug('Results', results);
        return results;
    }

    static datesToGridCodes(begin, end) {
        let beginDay = ArcgisService.getYearDay(begin);
        let indexBegin =  ((begin.getFullYear()  - START_YEAR) * 23) + (Math.floor(beginDay / 16));

        let endDay = ArcgisService.getYearDay(end);
        let indexEnd =  ((end.getFullYear()  - START_YEAR) * 23) + (Math.floor(endDay / 16) );

        let indexes = [];
        indexes[0] = indexBegin + 1; // +1 for not consider the 0 position in array of arcgis
        indexes[1] = indexEnd + 1;

        return indexes;
    }

    static alertCount(begin, end, histogram) {
        logger.debug('Histograms', histogram);
        let totalCount = 0;
        if (histogram) {
            let counts = [];
            if (histogram.histograms.length > 0) {
                counts = histogram.histograms[0].counts;
            }
            let indexes = ArcgisService.datesToGridCodes(begin, end);
            logger.debug('counts', JSON.stringify(counts));
            logger.debug('indexes', indexes);
            let subCounts = counts.slice(indexes[0], indexes[1] + 1);
            logger.debug('subCounts', JSON.stringify(subCounts));
            let sum = 0;
            if (subCounts && subCounts.length > 0) {
                sum = subCounts.reduce(function(oldVar, newVar) {
                    return oldVar + newVar;
                });
            }
            totalCount += sum;

        }
        return totalCount;
    }

    static * getAlertCount(begin, end, geojson) {
        logger.info('Get alerts count with begin ', begin, ' , end', end);
        begin = new Date(begin);
        end = new Date(end);
        try {
            let esriJSON = ArcgisService.geojsonToEsriJson(geojson);
            let histograms = yield ArcgisService.getHistogram(esriJSON);
            logger.debug('histograms', histograms);
            let alertCount = ArcgisService.alertCount(begin, end, histograms);
            logger.debug('AlertCount', alertCount);
            return {
                begin: begin.toISOString(),
                end: end.toISOString(),
                value: alertCount,
                notes: '' // TODO: Add notess
            };
        } catch (err) {
            logger.error(err);
            throw err;
        }
    }

    static getMaxDateFromHistograms(counts) {
        logger.debug('Obtaining max date from histograms');
        let year = START_YEAR + Math.floor((counts.length -1) / 23);
        let beginDate = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
        let daysFromStartYear = ((counts.length - 1) % 23) * 16; 
        let date = new Date(beginDate.getTime() + ((daysFromStartYear -1 ) * 24 * 60 * 60 * 1000));
        return date;
    }

    static formatCountsLatest(counts) {
        let results = {};
        let year = START_YEAR;
        let oldYear = null;
        let newValue = new Date(Date.UTC(START_YEAR, 0, 1));
        for (let i = 1, length = counts.length; i < length; i++) {

            if(!year || year !== oldYear){
                let newValue = new Date(Date.UTC(year, 0, 1));
            } else {
                newValue = new Date(newValue.getTime() + 24*60*60*1000);
            }
            year = newValue.getFullYear();
            if(!results[year]){
                results[year] = [];
            }
            results[year].push(counts[i]);
            oldYear = year;
            for(let j = 0; j < 15; j++){
                newValue = new Date(newValue.getTime() + 24*60*60*1000);
                year = newValue.getFullYear();
                if(year !== oldYear){
                    break;
                }
                if(!results[year]){
                    results[year] = [];
                }
                results[year].push(0);
            }

        }
        return results;
    }

    static * getFullHistogram() {
        logger.info('Get full histogram');

        var results = {};

        let url = `${IMAGE_SERVER}/histograms?f=pjson`;
        logger.debug(`Doing request to ${url}`);
        let result = yield coRequest({
            uri: url,
            method: 'GET',
            headers: {
                'Content-type': 'application/x-www-form-urlencoded'
            },
            json: true
        });

        if (result.statusCode === 200) {
            logger.debug('Response OK. body: ');
            results = ArcgisService.formatCountsLatest(result.body.histograms[0].counts);
        } else  {
            throw new Error('Error obtaining data in Arcgis');
        }


        return {
            minDate: new Date(Date.UTC(START_YEAR, 0, 1)).toISOString().slice(0, 10),
            maxDate: ArcgisService.getMaxDateFromHistograms(result.body.histograms[0].counts).toISOString().slice(0, 10),
            counts: results
        };
    }

    static generateQuery(iso, id1, dateYearBegin, yearBegin, dateYearEnd, yearEnd, confirmed) {
            let query = `select sum(count) as value from table where country_id='${iso}' ${id1 ? ` and state_id = '${id1}' `: ''} ${confirmed ? ' and confidence like \'confirmed\' ' : ''}`;
        if(yearBegin === yearEnd){
            query += ` and year like '${yearBegin}' and day::int >= ${dateYearBegin} and day::int <= ${dateYearEnd}`;
        } else {
            query += ' and (';
            logger.debug('Datebegin', dateYearBegin, 'end', dateYearEnd);
            for (let i = yearBegin; i <= yearEnd; i++) {
                if(i > yearBegin){
                    query +=' or ';
                }
                if(i === yearBegin){
                    query += `(year like '${i}' and day::int >= ${dateYearBegin})`;
                } else if(i === yearEnd) {
                    query += `(year like '${i}' and day::int <= ${dateYearEnd})`;
                } else {
                    query += `(year like '${i}')`;
                }
            }
            query += ')';
        }
        logger.debug('Query result: ', query);
        return query;
    }

    static * getAlertCountByJSON(begin, end, iso, id1, confirmedOnly ){
        logger.debug('Obtaining count with iso %s and id1 %s', iso, id1);
        let dateYearBegin = ArcgisService.getYearDay(begin);
        let yearBegin = begin.getFullYear();
        let dateYearEnd = ArcgisService.getYearDay(end);
        let yearEnd = end.getFullYear();

        let query = ArcgisService.generateQuery(iso, id1, dateYearBegin, yearBegin, dateYearEnd, yearEnd, confirmedOnly);
        logger.info('Doing request to ', `/query/${config.get('dataset.idGlad')}?sql=${query}`);
        let result = yield require('vizz.microservice-client').requestToMicroservice({
            uri: encodeURI(`/query/${config.get('dataset.idGlad')}?sql=${query}`),
            method: 'GET',
            json: true
        });

        if (result.statusCode !== 200) {
            logger.error('Error doing query:', result.body);
            // console.error(result);
            throw new Error('Error doing query');
        } else {
            return result.body.data[0];
        }
    }

    static * getAlertCountByISO(begin, end, iso){
        logger.info('Get alerts by iso %s', iso);
        let data = yield CartoDBService.getNational(iso);
        if(data) {
            logger.debug('Obtained geojson. Obtaining alerts');
            let alerts = yield ArcgisService.getAlertCountByJSON(begin, end, iso, null);
            if(!alerts){
                alerts = {
                    value: 0
                };
            }
            alerts.areaHa = data.areaHa;
            return alerts;
        }
        return null;
    }
    static * getAlertCountByID1(begin, end, iso, id1){
        logger.info('Get alerts by iso %s and id1', iso, id1);
        let data = yield CartoDBService.getSubnational(iso, id1);
        if(data) {
            logger.debug('Obtained geojson. Obtaining alerts');
            let alerts = yield ArcgisService.getAlertCountByJSON(begin, end, iso, id1);
            if(!alerts){
                alerts = {
                    value: 0
                };
            }
            alerts.areaHa = data.areaHa;
            return alerts;
        }
        return null;
    }
    static * getAlertCountByWDPA(begin, end, wdpaid){
        logger.info('Get alerts by wdpa %s', wdpaid);
        let data = yield CartoDBService.getWdpa(wdpaid);
        if(data) {
            logger.debug('Obtained geojson. Obtaining alerts', data.geojson);
            let alerts = yield ArcgisService.getAlertCount(begin, end, data.geojson);
            alerts.areaHa = data.areaHa;
            return alerts;
        }
        return null;
    }
    static * getAlertCountByUSE(begin, end, useTable, id){
        logger.info('Get alerts by use %s and id', useTable, id);
        let data = yield CartoDBService.getUse(useTable, id);
        if(data) {
            logger.debug('Obtained geojson. Obtaining alerts');
            let alerts = yield ArcgisService.getAlertCount(begin, end, data.geojson);
            alerts.areaHa = data.areaHa;
            return alerts;
        }
        return null;
    }
    static * getAlertCountByGeostore(begin, end, geostoreHash){
        logger.info('Get alerts by geostorehash %s', geostoreHash);
        let data = yield CartoDBService.getGeostore(geostoreHash);
        if(data) {
            logger.debug('Obtained geojson. Obtaining alerts');
            let alerts = yield ArcgisService.getAlertCount(begin, end, data.geojson.features[0].geometry);
            alerts.areaHa = data.areaHa;
            return alerts;
        }
        return null;
    }
}

module.exports = ArcgisService;
