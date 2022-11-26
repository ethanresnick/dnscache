/*
* Copyright (c) 2013, Yahoo! Inc. All rights reserved.
* Copyrights licensed under the New BSD License.
* See the accompanying LICENSE file for terms.
*/
var next = require('asap');

class CacheObject {
    constructor(conf = {}) {
        this.ttl = typeof conf.ttl === 'function'
            ? conf.ttl
            : (parseInt(conf.ttl, 10) || 300) * 1000; //0 is not permissible

        this.max = parseInt(conf.cachesize, 10) || 1000; //0 is not permissible

        this.count = 0;
        this.data = {};
    }

    set(key, value, callback) {
        next(() => {
            if (this.data[key]) {
                if (this.data[key].newer) {
                    if (this.data[key].older) {
                        this.data[key].newer.older = this.data[key].older;
                        this.data[key].older.newer = this.data[key].newer;
                    } else {
                        this.tail = this.data[key].newer;
                        delete this.tail.older;
                    }

                    this.data[key].older = this.head;
                    this.head.newer = this.data[key];
                    delete this.data[key].newer;
                    this.head = this.data[key];
                }

                this.head.val = value;
                this.head.hit = 0;
                this.head.ts = Date.now();
            } else {
                // key is not exist
                this.data[key] = {
                    "key" : key,
                    "val" : value,
                    "hit" : 0,
                    "ts" : Date.now()
                };

                if (!this.head) {
                    // cache is empty
                    this.head = this.data[key];
                    this.tail = this.data[key];
                } else {
                    // insert the new entry to the front
                    this.head.newer = this.data[key];
                    this.data[key].older = this.head;
                    this.head = this.data[key];
                }

                if (this.count >= this.max) {
                    // remove the tail
                    var temp = this.tail;
                    this.tail = this.tail.newer;
                    delete this.tail.next;
                    delete this.data[temp.key];
                } else {
                    this.count = this.count + 1;
                }
            }

            callback?.(null, value);
        });
    };

    get(key, callback) {
        if (!callback) {
            throw('cache.get callback is required.');
        }

        next(() => {
            if (!this.data[key]) {
                return callback(null, undefined);
            }

            const ttl = typeof this.ttl === 'number'
                ? this.ttl
                : (this.ttl(key) * 1000);

            const isExpired = (Date.now() - this.data[key].ts) >= ttl;

            if (!isExpired) {
                this.data[key].hit = this.data[key].hit + 1;
                callback(null, this.data[key].val);
                return;
            }

            // cleanup expired item
            if (this.data[key].newer) {
                if (this.data[key].older) {
                    // in the middle of the list
                    this.data[key].newer.older = this.data[key].older;
                    this.data[key].older.newer = this.data[key].newer;
                } else {
                    // tail
                    this.tail = this.data[key].newer;
                    delete this.tail.older;
                }
            } else {
                // the first item
                if (this.data[key].older) {
                    this.head = this.data[key].older;
                    delete this.head.newer;
                } else {
                    // 1 items
                    delete this.head;
                    delete this.tail;
                }
            }

            delete this.data[key];
            this.count = this.count - 1;
        });
    };
};

module.exports = CacheObject;
