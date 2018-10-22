define(
    ["Utils/IndexedDataStorage", "Logs/LogParser"],
    function(IndexedDataStorage, LogParser) {
    
        function LogProcessor() {
            var searchableFields = ["loglevel", "sid", "bid"];
            this.logs = new IndexedDataStorage(searchableFields);
        }
        
        LogProcessor.prototype.processInput = function(inputStr) {
            var parsedLogs = LogParser.parseInput(inputStr);
            this.logs.add(parsedLogs);
        };

        LogProcessor.prototype.getLogsByBusiness = function(bid) {
            return this.logs.hashSearch("bid", bid);
        }

        LogProcessor.prototype.getLogsBySession = function(sid) {
            return this.logs.hashSearch("sid", sid);
        }

        LogProcessor.prototype.getLogsByDateRange = function(dateFrom, dateTo) {
            dateFrom = (dateFrom instanceof Date) ? dateFrom : new Date(dateFrom);
            dateTo = (dateTo instanceof Date) ? dateTo : new Date(dateTo);
            return this.logs.fullSearch("date", dateFrom, dateTo);
        }

        return LogProcessor;
    }
)

