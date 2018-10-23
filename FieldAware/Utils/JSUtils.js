/**
 * Module where all simple extensions to JavaScript or utility methods are stored
 */
define(function() {
    return {
        /**
         * Wraps a given element in an array.
         * If the given element is already an array, nothing is done.
         * @param {Any} elem the given element
         */
        toArray: function(elem) {
            return Array.isArray(elem) ? elem : [elem];
        }
    };
})

