define(["Utils/JSUtils"], function(JSUtils) {
    function IndexedDataStorage(fields) {
        var self = this;
        self.entries = [];
        self.fields = JSUtils.toArray(fields);
        self.hashMaps = {};

        self.fields.forEach(function(field) {
            self.hashMaps[field] = {};
        });
    }

    IndexedDataStorage.prototype.addElement = function(elem) {
        var self = this;
        self.entries.push(elem);
        self.fields.forEach(function(field) {
            // Check if the element contains the searchable field
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

    IndexedDataStorage.prototype.add = function(elements) {
        var self = this;
        JSUtils.toArray(elements).forEach(function(elem) {
            self.addElement(elem);
        });
    }
    
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

