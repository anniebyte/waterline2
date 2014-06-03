/**
 * Module dependencies
 */

var util = require('util');
var _ = require('lodash');

var Deferred = require('root-require')('standalone/Deferred');
var WLError = require('root-require')('standalone/WLError');


/**
 * Contact adapter and perform specified `options.fn`.
 *
 * Build the Deferred object.
 *
 * @option  {Function}   options.fn
 * @option  {String}     options.method
 * @option  {Adapter}    options.adapter
 * @option  {Function}   options.callback
 * @option  {Function}   options.Switchback
 * @option  {ORM}   options.orm
 * @return {Deferred}
 */

module.exports = function _talkToAdapter (options) {


  // Instantiate a Deferred
  var deferred = new Deferred({
    type: options.method,
    Switchback: options.Switchback
  }, options.fn || function defaultFnToRunAdapterMethod (cb_from_adapter) {
    var _adapterMethod = options.adapter[options.method];

    // Interceptor method to ensure that all adapter errors are transformed
    // into WLError instances.
    var adapterMethodCb = function adapterMethodCb ( /* err, results */ ) {
      var args = Array.prototype.slice.call(arguments);
      var err = args[0];

      // If this is a `find()`, normalize results from adapter fn
      // to support WL1 (this backwards-compatibility measure is
      // only applied if ORM is specified and in compatibilityMode)
      if (options.method === 'find') {
        args[1] = _normalizeAdapterOutput(args[1], options.orm);
      }

      if (err) return cb_from_adapter(new WLError(err));
      else return cb_from_adapter.apply(null, args);
    };

    // "Switchbackify" the interceptor callback, if a `Switchback` factory was passed in
    // (this is so that adapters themselves may call `cb.invalid()`, etc.)
    if (options.Switchback) {
      adapterMethodCb = options.Switchback(adapterMethodCb, {invalid: 'error'});
    }


    var adapterArgs = options.args.concat([adapterMethodCb]);
    var wrappedAdapterMethod = _.partial.apply(null, [_adapterMethod].concat(adapterArgs));
    // console.log(_adapterMethod.toString());
    // console.log(wrappedAdapterMethod.toString());
    // console.log('passed arguments to adapter: ', util.inspect(adapterArgs,false,null));
    wrappedAdapterMethod();
  });

  // If `options.callback` (explicitCallback) was specified,
  // call `.exec()` on Deferred instance immediately.
  if (options.callback) {
    deferred.exec(options.callback);
  }
  return deferred;
};


/**
 * Tolerate unexpected results from adapter
 *
 * @param  {[type]} adapterResults [description]
 * @param  {[type]} orm            [description]
 * @return {[type]}                [description]
 */
function _normalizeAdapterOutput(adapterResults, orm) {

  if (!_.isArray(adapterResults)) {

    // To support WL1 core, if the result looks like a record,
    // just wrap it and treat it as a single-item array.
    // (e.g. this is a `findOne()` and it somehow got snipped)
    //
    // This can probably be removed in the future.
    if (orm && orm.compatibilityMode && _.isObject(adapterResults)) {
      adapterResults = [adapterResults];
    }
    else {
      // TODO: log warning that an unexpected result was returned, along with
      // the name of the adapter, the datastore, the model, and the criteria in
      // the query that triggered the issue (as well as the fact that this was
      // a "find()" query.)
      if (orm) {
        orm.emit('warn', 'Received unexpected result from adapter in find(): '+util.inspect(adapterResults));
      }
      adapterResults = [];
    }
  }

  return adapterResults;
}

