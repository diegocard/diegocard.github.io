require(
    ["Performance/PerfDecorator"],
    function(PerfDecorator) {
        var expect = chai.expect;
        mocha.setup('bdd')

        function createDelayedFunction(minDelay, maxDelay) {
            return function delayedFunction() {
                var delay = Math.floor(Math.random()*(maxDelay-minDelay+1)+minDelay);
                var start = new Date().getTime();
                while ((new Date() - start) < delay) {}
                return 1;
            }
        }

        describe('PerfDecorator', function() {
            describe('PerfDecorator()', function() {
                it('should register the proper amount of invocations', function(){
                    var testFunc = function() {
                        return 1;
                    }                    
                    var decoratedFunc = PerfDecorator(testFunc);
                    for (var i=0; i<10; i++) {
                        decoratedFunc();
                    }                    
                    expect(decoratedFunc.NumSamples).to.equal(10);
                });

                it('should register reasonable min execution times', function(){
                    var decoratedFunc = PerfDecorator(createDelayedFunction(50, 100));
                    for (var i=0; i<3; i++) {
                        decoratedFunc();
                    }
                    expect(decoratedFunc.Min).to.be.at.least(49);
                    expect(decoratedFunc.Min).to.be.at.most(101);
                });

                it('should register reasonable max execution times', function(){
                    var decoratedFunc = PerfDecorator(createDelayedFunction(50, 100));
                    for (var i=0; i<3; i++) {
                        decoratedFunc();
                    }
                    expect(decoratedFunc.Max).to.be.at.least(49);
                    expect(decoratedFunc.Max).to.be.at.most(101);
                });

                it('should register reasonable average execution times', function(){
                    var decoratedFunc = PerfDecorator(createDelayedFunction(50, 100));
                    for (var i=0; i<3; i++) {
                        decoratedFunc();
                    }
                    expect(decoratedFunc.Average).to.be.at.least(49);
                    expect(decoratedFunc.Average).to.be.at.most(101);
                });

                it('should should register an average time in between the min and max', function(){
                    var decoratedFunc = PerfDecorator(createDelayedFunction(50, 100));
                    for (var i=0; i<10; i++) {
                        decoratedFunc();
                    }
                    var minTime = decoratedFunc.Min;
                    var avgTime = decoratedFunc.Average;
                    var maxTime = decoratedFunc.Max;
                    expect(avgTime).to.be.at.least(minTime);
                    expect(avgTime).to.be.at.most(maxTime);
                });

                it('should log all necessary information', function(){
                    var decoratedFunc = PerfDecorator(createDelayedFunction(50, 100));
                    for (var i=0; i<10; i++) {
                        decoratedFunc();
                    }
                    
                    // Parse the log
                    var perfInfo = decoratedFunc.logPerfInfo();
                    var lines = perfInfo.split("\n");
                    var functionName = lines[0].split(" ")[1];
                    var numSamples = lines[1].split(" ")[1];
                    var minTime = lines[2].split(" ")[1].split("ms")[0];
                    var maxTime = lines[3].split(" ")[1].split("ms")[0];
                    var avgTime = lines[4].split(" ")[1].split("ms")[0];

                    // Check that all necessary information is found in the log
                    expect(functionName).to.equal("delayedFunction");
                    expect(numSamples).to.equal("10");
                    expect(minTime).to.not.be.empty;
                    expect(maxTime).to.not.be.empty;
                    expect(avgTime).to.not.be.empty;
                });
            });
        });
        
        mocha.checkLeaks();
        mocha.run();
    }
);