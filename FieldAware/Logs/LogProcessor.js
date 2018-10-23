/**
 * This module acts as a controller, exposing all the logic for parts 1 and 2
 * of the given exercise. This is:
 * - Process the input (parse the logs)
 * - Create an efficient in-memory structure that stores the logs
 * - Expose a method to get logs by business
 * - Expose a method to get logs by session
 * - Expose a method to get logs by date range
 */
define(
    ["Utils/IndexedDataStorage", "Logs/LogParser"],
    function(IndexedDataStorage, LogParser) {
    
        /**
         * This constructor takes a multi-purpose memory structure that I implemented
         * called IndexedDataStorage and configures it to store the log data in a very efficient way.
         * @public
         * @constructor
         */
        function LogProcessor() {
            // Logs are stored in an in-memory structure that contains indexes to
            // search through them by log level, session and business
            var searchableFields = ["loglevel", "sid", "bid"];
            this.logs = new IndexedDataStorage(searchableFields);
        }
        
        /**
         * This method processes the given input utilizing the
         * auxiliary LogParser module.
         * @public
         * @param {String} inputStr the given raw input for all logs
         */
        LogProcessor.prototype.processInput = function(inputStr) {
            var parsedLogs = LogParser.parseInput(inputStr);
            this.logs.add(parsedLogs);
        };

        /**
         * This method returns all log lines with a given log level.
         * The search is resolved in O(1) via a proper hash index.
         * @public
         * @param {String} loglevel the given log level
         * @returns {Array}
         */
        LogProcessor.prototype.getLogsByLogLevel = function(loglevel) {
            return this.logs.hashSearch("loglevel", loglevel);
        }

        /**
         * This method returns all log lines belonging to a given business
         * The search is resolved in O(1) via a proper hash index.
         * @public
         * @param {String} bid the given business id
         * @returns {Array}
         */
        LogProcessor.prototype.getLogsByBusiness = function(bid) {
            return this.logs.hashSearch("bid", bid);
        }

        /**
         * This method returns all log lines belonging to a given session.
         * The search is resolved in O(1) via a proper hash index.
         * @public
         * @param {String} sid the given session id
         * @returns {Array}
         */
        LogProcessor.prototype.getLogsBySession = function(sid) {
            return this.logs.hashSearch("sid", sid);
        }

        /**
         * This method returns all log lines within a given date range.
         * The search is resolved in O(n) iterating over all log entries.
         * @public
         * @param {String or Date} dateFrom beginning of the date range
         * @param {String or Date} dateTo end of the date range
         * @returns {Array}
         */
        LogProcessor.prototype.getLogsByDateRange = function(dateFrom, dateTo) {
            dateFrom = (dateFrom instanceof Date) ? dateFrom : new Date(dateFrom);
            dateTo = (dateTo instanceof Date) ? dateTo : new Date(dateTo);
            return this.logs.fullSearch("date", dateFrom, dateTo);
        }

        return LogProcessor;
    }
)

