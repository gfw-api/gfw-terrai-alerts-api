'use strict';

var Router = require('koa-router');
var logger = require('logger');
var CartoDBService = require('services/cartoDBService');
var ArcgisService = require('services/arcgisService');
var NotFound = require('errors/notFound');
var TerraiAlertsSerializer = require('serializers/terraiAlertsSerializer');


var router = new Router({
    prefix: '/terrai-alerts'
});

let getToday = function() {
    let today = new Date();
    return `${today.getFullYear().toString()}-${(today.getMonth()+1).toString()}-${today.getDate().toString()}`;
};

let getYesterday = function() {
    let yesterday = new Date(Date.now() - (24 * 60 * 60 * 1000));
    return `${yesterday.getFullYear().toString()}-${(yesterday.getMonth()+1).toString()}-${yesterday.getDate().toString()}`;
};

let defaultDate = function() {
    let to = getToday();
    let from = getYesterday();
    return from + ',' + to;
};

let getDates = function(period) {
    let dates = period.split(',');
    return {
        begin: new Date(dates[0]),
        end: new Date(dates[1])
    };
};

class TerraiAlertsRouter {
    static * getNational() {
        logger.info('Obtaining national data');
        let period = this.query.period;
        if(!period){
            period = defaultDate();
        }
        let dates = getDates(period);
        let data = yield ArcgisService.getAlertCountByISO(dates.begin, dates.end, this.params.iso, this.query.gladConfirmOnly);

        this.body = TerraiAlertsSerializer.serialize(data);

    }

    static * getSubnational() {
        logger.info('Obtaining subnational data');
        let period = this.query.period;
        if(!period){
            period = defaultDate();
        }
        let dates = getDates(period);
        let data = yield ArcgisService.getAlertCountByID1(dates.begin, dates.end, this.params.iso, this.params.id1, this.query.gladConfirmOnly);
        this.body = TerraiAlertsSerializer.serialize(data);
    }

    static * use() {
        logger.info('Obtaining use data with name %s and id %s', this.params.name, this.params.id);
        let period = this.query.period;
        if(!period){
            period = defaultDate();
        }
        let dates = getDates(period);
        let useTable = null;
        switch (this.params.name) {
            case 'mining':
                useTable = 'gfw_mining';
                break;
            case 'oilpalm':
                useTable = 'gfw_oil_palm';
                break;
            case 'fiber':
                useTable = 'gfw_wood_fiber';
                break;
            case 'logging':
                useTable = 'gfw_logging';
                break;
            case 'birds':
                useTable = 'endemic_bird_areas';
            default:
                useTable = this.params.name;
        }
        if (!useTable) {
            this.throw(404, 'Name not found');
        }
        let data = yield ArcgisService.getAlertCountByUSE(dates.begin, dates.end, useTable, this.params.id, this.query.gladConfirmOnly);
        this.body = TerraiAlertsSerializer.serialize(data);

    }

    static * wdpa() {
        logger.info('Obtaining wpda data with id %s', this.params.id);
        let period = this.query.period;
        if(!period){
            period = defaultDate();
        }
        let dates = getDates(period);
        let data = yield ArcgisService.getAlertCountByWDPA(dates.begin, dates.end, this.params.id, this.query.gladConfirmOnly);
        this.body = TerraiAlertsSerializer.serialize(data);
    }

    static * world() {
        logger.info('Obtaining world data');
        this.assert(this.query.geostore, 400, 'GeoJSON param required');
        try {
            let period = this.query.period;
            if(!period){
                period = defaultDate();
            }
            let dates = getDates(period);
            let data = yield ArcgisService.getAlertCountByGeostore(dates.begin, dates.end, this.query.geostore, this.query.gladConfirmOnly);

            this.body = TerraiAlertsSerializer.serialize(data);
        } catch (err) {
            if (err instanceof NotFound) {
                this.throw(404, 'Geostore not found');
                return;
            }
            throw err;
        }

    }

    static * latest() {
        logger.info('Obtaining latest data');
        let data = yield ArcgisService.getFullHistogram(this.query.limit);
        this.body = TerraiAlertsSerializer.serializeLatest(data);
    }

}

var isCached = function*(next) {
    if (yield this.cashed()) {
        return;
    }
    yield next;
};



router.get('/admin/:iso', isCached, TerraiAlertsRouter.getNational);
router.get('/admin/:iso/:id1', isCached, TerraiAlertsRouter.getSubnational);
router.get('/use/:name/:id', isCached, TerraiAlertsRouter.use);
router.get('/wdpa/:id', isCached, TerraiAlertsRouter.wdpa);
router.get('/', isCached, TerraiAlertsRouter.world);
router.get('/latest', isCached, TerraiAlertsRouter.latest);


module.exports = router;
