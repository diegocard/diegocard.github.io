/**
 * This module defines a reusable efficient in-memory data structure.
 * It allows for the storage of information, and the entries can be searched
 * efficiently through indexes that are specified upon creation of the structure.
 * All indexes are implemented as open hash maps and indexed searches are resolved in O(1).
 * Additionally, information can be searched by other non-indexed fields in O(n).
 * Note that entries are created only once and not duplicated for indexing purposes.
 * Indexes contain references to the existing entries. This keeps space complexity small.
 */
define(["Utils/JSUtils"], function(JSUtils) {

    /**
     * Constructor for the in-memory structure
     * @constructor
     * @public
     * @param {Array} fields array with all the field names that will become indexes
     */
    function IndexedDataStorage(fields) {
        var self = this;
        // All entries are stored here
        self.entries = [];
        // Field names for indexes
        self.fields = JSUtils.toArray(fields);
        // Index structure is stored here
        self.hashMaps = {};
        // Initialize the index structure
        self.fields.forEach(function(field) {
            self.hashMaps[field] = {};
        });
    }

    /**
     * Stores a single element
     * @public
     * @param {Object} elem the given element to be stored.
     */
    IndexedDataStorage.prototype.addElement = function(elem) {
        var self = this;
        // Add the entry to the array of all entries
        self.entries.push(elem);
        // For each searchable index field
        self.fields.forEach(function(field) {
            // Check if the given element contains the searchable field
            if (Object.keys(elem).includes(field)) {
                var value = elem[field];
                var hashMapEntry = self.hashMaps[field][value];
                // Check if the entry in the hash map exists. Otherwise, create it
                if (!hashMapEntry) {
                    hashMapEntry = [];
                }
                // Add the current value to the hash map entry
                hashMapEntry.push(elem);
                self.hashMaps[field][value] = hashMapEntry;
            }
        });
    }

    /**
     * Stores a series of one or more elements
     * @public
     * @param {Array or Object} elements given elements
     */
    IndexedDataStorage.prototype.add = function(elements) {
        var self = this;
        JSUtils.toArray(elements).forEach(function(elem) {
            self.addElement(elem);
        });
    }
    
    /**
     * Executes a hash (indexed) search for all elements that contain
     * a given value for a given field.
     * This search is resolved in O(1)
     * @public
     * @param {String} field given field to search by
     * @param {Any} value the given value we are looking for
     * @returns {Array}
     */
    IndexedDataStorage.prototype.hashSearch = function(field, value) {
        var self = this;
        // Check that the given field is actually a hash index
        if (!self.fields.includes(field)) {
            console.error("The given field is not a hash index");
        } else {
            // Execute a hash search
            var result = self.hashMaps[field][value];
            return result ? result : [];
        }
    }

    /**
     * Executes a hash (indexed) search for all elements that contain
     * whose value for a given field is within a given range.
     * This search is resolved in O(n)
     * @public
     * @param {String} field given field to search by
     * @param {Any} from the start of the range of values we are looking for
     * @param {Any} to the end of the range of values we are looking for
     * @returns {Array}
     */
    IndexedDataStorage.prototype.fullSearch = function(field, from, to) {
        var self = this;
        // If no "to" value is specified, use the same value as "from"
        to = to || from;
        // Iterate through all entries (no hash)
        return self.entries.filter(function (entry) {
            // Get the value for the given field on the current entry
            var value = entry[field];
            // Check if this value fulfills the given search criteria
            return value >= from && value <= to;
        });
    }

    return IndexedDataStorage;
})

