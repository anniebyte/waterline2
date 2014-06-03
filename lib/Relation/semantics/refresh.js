/**
 * Module dependencies
 */

var _ = require('lodash');

var Junction = require('../Junction');
var AssociationRule = require('../AssociationRule');

var WLUsageError = require('root-require')('standalone/WLError/WLUsageError');


/**
 * Refresh this relation's datastore, adapter, associations and related
 * metadata (i.e. keys/junctions/associated relations) as well as any other
 * future configuration.  Should be run on participating relations whenever
 * the ontology changes.
 *
 * @chainable
 * @return {Relation}
 *
 * @api private
 */

module.exports = function refresh () {
  // console.log('REFRESHING',this.identity, 'and its attributes:',this.attributes);

  // Closure access to `orm`,`identity`,etc. for use below
  var orm = this.orm;
  var identity = this.identity;
  var self = this;

  // Normalize the definition of this relation and each of its attributes:
  // `tableName`+`cid`+`identity` --> `cid`
  this.cid = this.cid||this.tableName||this.identity;
  this.attributes = _.mapValues(this.attributes, function (attrDef, attrName) {
    // `columnName`+`fieldName`+attrName --> `fieldName`
    attrDef.fieldName = attrDef.fieldName||attrDef.columnName||attrName;
    // `model` --> `association: { plural: false, entity: 'model', identity: '...' }`
    if (attrDef.model) {
      attrDef.association = _.defaultsDeep(attrDef.association||{}, {
        entity: 'model',
        identity: attrDef.model,
        plural: false,

        // Determine the default, built-in association rule to use
        // (currently, always `hasFK`)
        // (but eventually it could also  be `embedsObject`)
        rule: 'hasFK'
      });
    }
    // `collection` --> `association: { plural: true, entity: 'model', identity: '...' }`
    else if (attrDef.collection) {
      attrDef.association = _.defaultsDeep(attrDef.association||{}, {
        entity: 'model',
        identity: attrDef.collection,
        plural: true,

        // Determine the default, built-in association rule to use
        // Could be `viaFK` or `viaJunction`
        // (or eventually, could also be `hasFKArray`, `viaFKArray`, or `embedsArray`)
        rule: (function _getAppropriateDefaultARKey () {

          // If another model+attribute exists with a `model` pointed back
          // at this relation's `identity`, the `via-fk` AR should be applied.
          if (attrDef.via && (
            function _viaOnOtherRelation (){
              var otherRelation;
              otherRelation = orm.model(attrDef.collection);
              otherRelation = otherRelation||orm.junction(attrDef.collection);

              // TODO: wait until other things have loaded before trying to do
              // this kind of lookup with intrinsic dependencies.

              var backreference = otherRelation.attributes[attrDef.via];
              return backreference && backreference.model === identity;
            }
          )()) {
            return 'viaFk';
          }

          // If another model+attribute exists with a `via` pointed back
          // at `attrName`, the `via-junction` AR should be applied.
          // Actually, it'll get applied regardless because it is the strategy
          // used for both bidirectional hasMany (collection-->via<--collection)
          // and unidirectional hasMany (collection-->)
          else {
            return 'viaJunction';
          }

        })()
      });
    }
    return attrDef;
  });

  // Default the `schema` flag based on the adapter's configuration
  var adapter = this.getAdapter();
  var datastore = this.getDatastore();
  if (adapter) {
    this.schema = this.schema||datastore.schema||adapter.schema||false;
  }


  // Ensure ORM is known -- cannot refresh() without it.
  if (!orm) {
    throw new WLUsageError(util.format('Relation "%s" is not attached to an ORM', identity));
  }

  // TODO: get actual primary key, etc. from waterline-schema
  // (already using it in `ORM.prototype.refresh()`)
  // TODO: if defaulting to `id`, we need to make sure the attribute actually exists
  this.primaryKey = this.primaryKey||'id';

  // console.log('Refreshed `this.primaryKey` FOR '+this.identity);

  // For each association, locate its configured rule if one exists.
  // Otherwise, default to built-in conventions.  Either way, refresh
  // the AssociationRule before moving on.
  this.associationRules = _.reduce(this.attributes, function (memo, attrDef, attrName) {

    // Ignore primitive attributes
    // (TODO: consider..? maybe there's a use case for not doing this? e.g. mongo embeds?)
    if (!attrDef.association) return memo;

    // Default to conventional behavior
    var rule = new AssociationRule({
      parent: self,
      attrName: attrName
    });

    // Attempt to locate association rule configuration,
    // then mix in overrides:

    // TODO:
    // Allow for more versatile config options for association rules
    // at the model, datastore, adapter, and ORM level.


    // Provided w/i the attribute definition,
    if (attrDef.association.rule) {

      // If a string was specified, it refers to one of the built-in
      // AR strategies.  Resolve it to an object and merge it in to
      // our new AssociationRule instance.
      if (_.isString(attrDef.association.rule)) {
        rule = _.merge(rule, orm.getDefaultAR(attrDef.association.rule));
      }
      // Lower-level, direct overrides (config object syntax)
      else if (_.isObject(attrDef.association.rule)) {
        rule = _.merge(rule, attrDef.association.rule);
      }

      // (then remove the association rule config from the attrDef
      //  to enforce a consistent access pattern for ourselves throughout
      //  the rest of core.)
      delete attrDef.association.rule;
    }


    // Save the rule to this relation, then refresh() it.
    memo.push(rule);
    rule.refresh();
    return memo;
  }, []);

  return this;
};










  // TODO:
  // At some point, look into decentralizing the data comprising the
  // topology of an ORMs data model into the respective adapters, datastores,
  // and relations rather than storing it in the ORM instance.  This could
  // more-easily enable some interesting integration possiblities between
  // other ontologies at runtime (e.g. public APIs, commercial web services, etc)
  // e.g. consider the following integration:
  //
  // ```
  // var twitter = require('wl-twitter')({ apiKey: '...', apiSecret: '...' });
  // var Tweet = twitter.model('tweet');
  // Tweet.find().limit(30).populate('author').log();
  // ```
  //
  // But now imagine you had these sick-ass runtime ontological morph powers:
  //
  // ```
  // var twitter = require('wl-twitter')({ apiKey: '...', apiSecret: '...' });
  // var Tweet = twitter.model('tweet');
  // var User = myORM.model('user');
  //
  // Tweet.identifyRelation('ourUser').withOne(User).on({
  //   '{{tweet.author}}': '{{user.twitterProviderId}}'
  // });
  // User.identifyRelation('tweets').withMany(Tweet).on({
  //   '{{tweet.author}}': '{{user.twitterProviderId}}'
  // });
  //
  // // Now we can get all the Tweets by any of this app's users:
  // Tweet.find({ ourUser: { '!': null } }).limit(30).populate('author').log();
  // ```




  // Build association metadata (can probably be replaced by the above)
  // TODO: use waterline-schema for this
  // this.associations = _.reduce(this.attributes, function (memo, attrDef, attrName) {
  //   console.log('is %s an association? :: ', attrName, (_.isObject(attrDef) && (attrDef.model || attrDef.collection)));
  //   if (_.isObject(attrDef) && (attrDef.model || attrDef.collection)) {

  //     var relatedIdentity = attrDef.model || attrDef.collection;
  //     var relatedRelation = orm.model(relatedIdentity);

  //     // actually don't do this:
  //     //
  //     // // Skip this association if the related model/junction doesn't exist yet
  //     // // (fails silently)
  //     // if (!relatedRelation) return memo;

  //     // Build association def
  //     var assoc = {
  //       // The `target` is the model or junction which is
  //       // the target of our population.
  //       target: relatedRelation,

  //       // The `keeper` is the model or junction which
  //       // _actually has_ (or "keeps") the foreign key(s).
  //       keeper: null,

  //       // This object has a key for each model that is _pointed to_.
  //       // That is, these foreign keys are named for the model to
  //       // which they _point_, NOT the model in which they _reside_.
  //       foreignKeys: {}
  //     };

  //     // TODO: get junction from WLSchema
  //     var junction;

  //     console.log('lookng for associations in relation: "%s"', self.identity);

  //     // One-way "hasOne" association
  //     if (attrDef.model) {
  //       assoc.type = '1-->N';
  //       assoc.cardinality = 1;
  //       assoc.oneway = true;
  //       assoc.keeper = self;
  //       assoc.foreignKeys[relatedIdentity] = attrName;
  //       // console.log(' -> identified hasOne association (%s) on relation (%s)', attrName,self.identity);
  //     }
  //     // One-way "hasMany" association
  //     else if (attrDef.collection && !attrDef.via) {
  //       throw new WLUsageError('N-->M (via-less collection) associations are not supported in WL2 yet.');
  //       assoc.type = 'N-->M';
  //       assoc.cardinality = 'n';
  //       assoc.oneway = true;
  //       // junction = orm.junction(attrName+'', {

  //       // });
  //       assoc.keeper = junction;

  //       // assoc.foreignKeys[identity] = junction.foreignKeys[identity];
  //       // assoc.foreignKeys[relatedIdentity] = junction.foreignKeys[relatedIdentity];
  //     }
  //     // Two-way "belongsToMany" association
  //     else if (
  //       attrDef.collection && attrDef.via &&
  //       relatedRelation.attributes[attrDef.via] &&
  //       relatedRelation.attributes[attrDef.via].model
  //     ) {
  //       assoc.type = 'N<->1';
  //       assoc.cardinality = 'n';
  //       assoc.oneway = false;
  //       assoc.keeper = relatedRelation;
  //       assoc.foreignKeys[identity] = attrDef.via;
  //     }
  //     // Two-way "hasMany" association
  //     else if (
  //       attrDef.collection && attrDef.via &&
  //       relatedRelation.attributes[attrDef.via] &&
  //       relatedRelation.attributes[attrDef.via].collection &&
  //       relatedRelation.attributes[attrDef.via].via === attrName
  //     ) {
  //       throw new WLUsageError('N<->M (collection via collection) associations are not supported in WL2 yet.');
  //       // assoc.type = 'N<->M';
  //       // assoc.cardinality = 'n';
  //       // assoc.oneway = false;
  //       // assoc.keeper = junction;
  //       // assoc.foreignKeys[identity] = junction.foreignKeys[identity];
  //       // assoc.foreignKeys[relatedIdentity] = junction.foreignKeys[relatedIdentity];
  //     }

  //     // var isManyToMany = assoc.type === 'N<->M' || assoc.type === 'N-->M';
  //     // console.log('ASSOC ('+identity+'.'+attrName+'):::',assoc);

  //     memo[attrName] = assoc;
  //   }
  //   return memo;
  // }, {});

  // console.log('Refreshed',this.identity, 'and now associations are:',Object.keys(this.associations));