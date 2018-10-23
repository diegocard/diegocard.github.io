/**
 * This module exposes a generic decorator that can be applied to any function
 * to collect basic performance statistics about itself.
 */
define(function() {
    
    /**
     * This is the main method exposed by the module. It wraps a given function,
     * collecting performance information about itself.
     * @public
     * @param {Function} func the function to be decorated (wrapped)
     * @returns {Function}
     */
    function perfDecorator(func) {  
        // Prepare the decorated function to be returnbed
        var decorated = function () {
            // Measure the execution time (ms)
            var start = performance.now(),
                result = func.apply(this, arguments),
                time = Math.round(performance.now() - start);
            // Register the new execution time
            registerNewExecution(decorated, time);
            return result;
        };
        // Add properties to the decorated function
        decorated.Name = func.name;
        decorated.NumSamples = 0;
        decorated.Average = 0;
        // Add a method to the decorated function that logs all performance information
        addLoggingMethod(decorated);
        return decorated;
    }

    /**
     * Registers a new execution time for the decorated function
     * @private
     * @param {Function} decorated the decorated function
     * @param {Int} time the 
     */
    function registerNewExecution(decorated, time) {
        // Increment the number of samples recorded
        decorated.NumSamples++;
        // Initialize min and max values if necessary
        if (!decorated.Min) decorated.Min = time;
        if (!decorated.Max) decorated.Max = time;
        // Check if we found new min or max time values
        if (time < decorated.Min) {
            decorated.Min = time;
        }
        if (time > decorated.Max) {
            decorated.Max = time;
        }
        // Calculate the averate execution time as a rolling average
        decorated.Average = ((decorated.Average)*(decorated.NumSamples-1) + time) / decorated.NumSamples;
    }

    /**
     * Adds a method that logs all performance information on the decorated function
     * @private
     * @param {Function} decorated the decorated function
     */
    function addLoggingMethod(decorated) {
        // This function will log all performance-related information
        decorated.logPerfInfo = function() {
            var result =
                "Function: " + decorated.Name + "\n" +
                "NumSamples: " + decorated.NumSamples + "\n" +
                "Min: " + decorated.Min + "ms\n" +
                "Max: " + decorated.Max + "ms\n" +
                "Average: " + decorated.Average + "ms";
            // The information is logged and returned
            console.log(result);
            return result;
        }
    }
    
    return perfDecorator;
})