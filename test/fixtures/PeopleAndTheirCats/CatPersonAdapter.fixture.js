/**
 * Module dependencies
 */

var util = require('util');
var assert = require('assert');
var WLTransform = require('waterline-criteria');
var rootrequire = require('root-require');
var Waterline = rootrequire('./');

/**
 * CatPersonAdapter (fixture)
 *
 * Factory which returns the definition of the CatPersonAdapter fixture.
 * @return {Object}
 */

module.exports = function build_CatPersonAdapter() {

  return {

    apiVersion: '2.0.0',

    find: function (db, cid, criteria, cb) {
      assert(
        typeof criteria === 'object',
        '"criteria" argument should exist, and be an object- instead got:\n'+util.inspect(criteria)
      );
      assert(
        !(Waterline.Relation.isRelation(criteria)),
        '"criteria" argument SHOULD NOT be an instance of Relation- but it was:\n'+util.inspect(criteria)
      );
      assert(
        !(Waterline.Datastore.isDatastore(criteria)),
        '"criteria" argument SHOULD NOT be an instance of Datastore- but it was:\n'+util.inspect(criteria)
      );
      assert(
        typeof cb === 'function',
        '"callback" argument should exist, and be a function- instead got:\n'+util.inspect(cb)
      );

      // console.log('\n\n------------------\nin catperson adapter w/ args:', util.inspect(arguments, false, null));

      setTimeout(function afterSimulatedLookupDelay () {

        var results = WLTransform(criteria.from.identity, {
          person: require('./person.dataset.fixture'),
          cat: require('./cat.dataset.fixture')
        }, criteria).results;
        return cb(null, results);
      }, 0);
    }
  };
};
