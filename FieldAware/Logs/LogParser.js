/**
 * This module contains all the logic necessary to parse a set of log entries,
 * converting them into a in-memory structure.
 */
define(function() {
    /**
     * This method parses a single log entry (string), converting it into an in-memory object.
     * @private 
     * @param {String} lineStr the given line for this log entry
     * @returns {Object}
     */
    function parseLine(lineStr) {
        try {
            // Separate the log's metadata and description
            var splitLog = lineStr.split("'"),
                logMetadata = splitLog[0].split(" "),
                logDescription = splitLog[1];
            // Prepare the object containing all the information for a single log
            return {
                description: logDescription,
                date: new Date(logMetadata[0] + " " + logMetadata[1]),
                loglevel: logMetadata[2],
                sid: logMetadata[3].split(":")[1],
                bid: logMetadata[4].split(":")[1],
                rid: logMetadata[5].split(":")[1]
            }
        } catch (e) {
           throw "Error while parsing - incorrect formatting found";
        }
    }

    /**
     * This is the one public interface exposed by the module. It takes a raw input that
     * can potentially contain multiple log entries and returns an in-memory structure 
     * (array) containing the information for all the given logs.
     * @public
     * @param {String} inputStr the given raw input
     * @returns {Array}
     */
    function parseInput(inputStr) {
        return inputStr
            .split("\n")
            .map(parseLine);
    }

    return {
        parseInput: parseInput
    };
})

