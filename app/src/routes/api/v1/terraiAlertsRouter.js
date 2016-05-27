'use strict';

var Router = require('koa-router');
var logger = require('logger');
var CartoDBService = require('services/cartoDBService');
var NotFound = require('errors/notFound');
var TerraiAlertsSerializer = require('serializers/terraiAlertsSerializer');


var router = new Router({
    prefix: '/terrai-alerts'
});

class TerraiAlertsRouter {
    static * getNational() {
        logger.info('Obtaining national data');
        let data = yield CartoDBService.getNational(this.params.iso, this.query.period);
        logger.debug(data);
        this.body = TerraiAlertsSerializer.serialize(data);
    }

    static * getSubnational() {
        logger.info('Obtaining subnational data');
        let data = yield CartoDBService.getSubnational(this.params.iso, this.params.id1, this.query.period);
        this.body = TerraiAlertsSerializer.serialize(data);
    }

    static * use() {
        logger.info('Obtaining use data with name %s and id %s', this.params.name, this.params.id);
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
            default:
                this.throw(400, 'Name param invalid');
        }
        if (!useTable) {
            this.throw(404, 'Name not found');
        }
        let data = yield CartoDBService.getUse(useTable, this.params.id, this.query.period);
        this.body = TerraiAlertsSerializer.serialize(data);

    }

    static * wdpa() {
        logger.info('Obtaining wpda data with id %s', this.params.id);
        let data = yield CartoDBService.getWdpa(this.params.id, this.query.period);
        this.body = TerraiAlertsSerializer.serialize(data);
    }

    static * world() {
        logger.info('Obtaining world data');
        this.assert(this.query.geostore, 400, 'GeoJSON param required');
        try{
            let data = yield CartoDBService.getWorld(this.query.geostore, this.query.period);

            this.body = TerraiAlertsSerializer.serialize(data);
        } catch(err){
            if(err instanceof NotFound){
                this.throw(404, 'Geostore not found');
                return;
            }
            throw err;
        }

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


module.exports = router;
