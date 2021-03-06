/**
 * Module dependencies
 */

var rootrequire = require('root-require');
var Waterline = rootrequire('./');



/**
 * PeopleAndTheirChats (fixture)
 * @return {ORM}
 */

module.exports = function PeopleAndTheirChats () {

  return Waterline({
    models: {
      person: {
        datastore: 'default',
        attributes: {
          id: { type: 'integer', primaryKey: true },
          name: { type: 'string' },
          email: { type: 'string' }
        }
      },
      chat: {
        datastore: 'default',
        attributes: {
          id: { type: 'integer', primaryKey: true },
          message: {type: 'string'},
          recipients: {
            collection: 'person'
          }
        }
      }
    },
    datastores: {
      default: {
        adapter: 'default'
      }
    },
    adapters: {
      'default': require('./adapter')()
    }
  });
};


