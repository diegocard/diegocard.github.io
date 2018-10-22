require(
    ["Logs/LogParser", "Logs/LogProcessor"],
    function(LogParser, LogProcessor) {
        var expect = chai.expect;
        mocha.setup('bdd')

        // Test data provided in the exercise
        var testData = "";
        testData += "2012-09-13 16:04:22 DEBUG SID:34523 BID:1329 RID:65d33 'Starting new session'\n";
        testData += "2012-09-13 16:04:30 DEBUG SID:34523 BID:1329 RID:54f22 'Authenticating User'\n";
        testData += "2012-09-13 16:05:30 DEBUG SID:42111 BID:319 RID:65a23 'Starting new session'\n";
        testData += "2012-09-13 16:04:50 ERROR SID:34523 BID:1329 RID:54ff3 'Missing Authentication token'\n";
        testData += "2012-09-13 16:05:31 DEBUG SID:42111 BID:319 RID:86472 'Authenticating User'\n";
        testData += "2012-09-13 16:05:31 DEBUG SID:42111 BID:319 RID:7a323 'Deleting asset with ID 543234'\n";
        testData += "2012-09-13 16:05:32 WARN SID:42111 BID:319 RID:7a323 'Invalid asset ID'";

        describe('LogParser', function() {
            describe('parseInput()', function() {
                it('should fail if the input does not match the expected format', function(){
                    var input = "AAA:374374:222";
                    function exceptionTest() {
                        LogParser.parseInput(input);
                    }
                    expect(exceptionTest).to.throw("Error while parsing - incorrect formatting found");
                });

                it ("should parse all elements in a given line", function() {
                    var result = LogParser.parseInput(testData);
                    expect(result[0]).to.deep.include({bid: "1329"});
                    expect(result[0]).to.deep.include({date: new Date("2012-09-13 16:04:22")});
                    expect(result[0]).to.deep.include({description: "Starting new session"});
                    expect(result[0]).to.deep.include({loglevel: "DEBUG"});
                    expect(result[0]).to.deep.include({rid: "65d33"});
                    expect(result[0]).to.deep.include({sid: "34523"});
                });

                it ("should parse multiple lines", function() {
                    var result = LogParser.parseInput(testData);
                    expect(result.length).to.equal(7);
                });
            });
        });

        describe('LogProcessor', function() {
            describe('processInput()', function() {
                it('should allow for the processing of logs', function(){
                    var lp = new LogProcessor();
                    lp.processInput(testData);
                    expect(lp.logs.entries.length).to.equal(7);
                });

                it ("should return all log lines with a given log level", function() {
                    var lp = new LogProcessor();
                    lp.processInput(testData);
                    expect(lp.logs.entries.length).to.equal(7);
                });

                it ("should return all log lines belonging to a given business", function() {
                    var lp = new LogProcessor();
                    lp.processInput(testData);
                    var result = lp.getLogsByBusiness("1329");
                    expect(result.length).to.equal(3);
                    expect(result[0]).to.deep.include({description: "Starting new session"});
                    expect(result[1]).to.deep.include({description: "Authenticating User"});
                    expect(result[2]).to.deep.include({description: "Missing Authentication token"});
                });

                it ("should return all log lines for a given session id", function() {
                    var lp = new LogProcessor();
                    lp.processInput(testData);
                    var result = lp.getLogsByBusiness("319");
                    expect(result.length).to.equal(4);
                    expect(result[0]).to.deep.include({description: "Starting new session"});
                    expect(result[1]).to.deep.include({description: "Authenticating User"});
                    expect(result[2]).to.deep.include({description: "Deleting asset with ID 543234"});
                    expect(result[3]).to.deep.include({description: "Invalid asset ID"});
                });

                it ("should return all log lines within a given date range", function() {
                    var lp = new LogProcessor();
                    lp.processInput(testData);
                    var result = lp.getLogsByDateRange("2012-09-13 16:04:22", "2012-09-13 16:04:50");
                    expect(result.length).to.equal(3);
                    expect(result[0]).to.deep.include({description: "Starting new session"});
                    expect(result[1]).to.deep.include({description: "Authenticating User"});
                    expect(result[2]).to.deep.include({description: "Missing Authentication token"});
                });
            });
        });
       
        mocha.checkLeaks();
        mocha.run();
    }
);