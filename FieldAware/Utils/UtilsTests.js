require(
    ["Utils/JSUtils", "Utils/IndexedDataStorage"],
    function(JSUtils, IndexedDataStorage) {
        var expect = chai.expect;
        mocha.setup('bdd')

        describe('JSUtils', function() {
            describe('toArray()', function() {
                it('should do nothing when the input is an array', function(){
                    var input = [1,2,3];
                    expect(JSUtils.toArray(input)).to.equal(input);
                });

                it('should create an array for basic data types', function(){
                    let result = JSUtils.toArray(1);
                    expect(result).to.be.an("array");
                    expect(result.length).to.equal(1);
                    expect(result).to.include(1);
                });
            });
        });

        describe('IndexedDataStorage', function() {
            describe('Initial structure', function() {
                it('should initialize entries correctly', function(){
                    var input = new IndexedDataStorage(["a", "b", "c"]);
                    expect(input.entries).to.be.an("array").that.is.empty;
                });

                it('should initialize fields correctly', function(){
                    var input = new IndexedDataStorage(["a", "b", "c"]);
                    expect(input.fields).to.be.an("array");
                    expect(input.fields).to.include("a");
                    expect(input.fields).to.include("b");
                    expect(input.fields).to.include("c");
                });

                it('should initialize hashMaps correctly', function(){
                    var input = new IndexedDataStorage(["a", "b", "c"]);
                    expect(input.hashMaps).to.be.an("object");
                    expect(input.hashMaps).to.deep.include({a: {}});
                    expect(input.hashMaps).to.deep.include({b: {}});
                    expect(input.hashMaps).to.deep.include({c: {}});
                });
            });

            describe('addElement()', function() {
                it('should add elements one by one correctly', function(){
                    var input = new IndexedDataStorage(["a", "b", "c"]);
                    var element1 = {a:1, b:2, c:3};
                    var element2 = {a:1, b:2, c:4};
                    input.addElement(element1);
                    input.addElement(element2);
                    expect(input.hashMaps).to.deep.include({a: {"1": [element1, element2]}});
                    expect(input.hashMaps).to.deep.include({b: {"2": [element1, element2]}});
                    expect(input.hashMaps).to.deep.include({c: {"3": [element1], "4": [element2]}});
                });
            });

            describe('add()', function() {
                it('should add elements in batch correctly', function(){
                    var input = new IndexedDataStorage(["a", "b", "c"]);
                    var element1 = {a:1, b:2, c:3};
                    var element2 = {a:1, b:2, c:4};
                    input.add([element1, element2]);
                    expect(input.hashMaps).to.deep.include({a: {"1": [element1, element2]}});
                    expect(input.hashMaps).to.deep.include({b: {"2": [element1, element2]}});
                    expect(input.hashMaps).to.deep.include({c: {"3": [element1], "4": [element2]}});
                });
            });

            describe('hashSearch()', function() {
                it('should allow for the indexed search of elements', function(){
                    var input = new IndexedDataStorage(["a", "b", "c"]);
                    var element1 = {a:1, b:2, c:3};
                    var element2 = {a:1, b:2, c:4};
                    input.add([element1, element2]);
                    expect(input.hashSearch("a", 1)).to.include(element1).and.to.include(element2);
                    expect(input.hashSearch("b", 2)).to.include(element1).and.to.include(element2);
                    expect(input.hashSearch("c", 3)).to.include(element1).and.to.not.include(element2);
                    expect(input.hashSearch("c", 4)).to.include(element2).and.to.not.include(element1);
                });

                it('should return an empty array when no elements are found', function(){
                    var input = new IndexedDataStorage(["a", "b", "c"]);
                    var element1 = {a:1, b:2, c:3};
                    var element2 = {a:1, b:2, c:4};
                    input.add([element1, element2]);
                    expect(input.hashSearch("b", 1)).to.be.an("array").and.to.be.empty;
                });
            });

            describe('fullSearch()', function() {
                it('should allow for the unindexed search of elements', function(){
                    var input = new IndexedDataStorage(["c"]);
                    var element1 = {a:1, b:2, c:3};
                    var element2 = {a:2, b:2, c:4};
                    input.add([element1, element2]);
                    expect(input.fullSearch("a", 1)).to.include(element1).and.to.not.include(element2);
                    expect(input.fullSearch("b", 2)).to.include(element1).and.to.include(element2);
                });

                it('should allow for the search of elements within a range of values', function(){
                    var input = new IndexedDataStorage(["c"]);
                    var element1 = {a:1, b:2, c:3};
                    var element2 = {a:2, b:2, c:4};
                    input.add([element1, element2]);
                    expect(input.fullSearch("a", 1, 3)).to.include(element1).and.to.include(element2);
                    expect(input.fullSearch("a", 1, 1)).to.include(element1).and.to.not.include(element2);
                    expect(input.fullSearch("b", 1, 4)).to.include(element1).and.to.include(element2);
                });

                it('should return an empty array when no elements are found', function(){
                    var input = new IndexedDataStorage(["c"]);
                    var element1 = {a:1, b:2, c:3};
                    var element2 = {a:2, b:2, c:4};
                    input.add([element1, element2]);
                    expect(input.fullSearch("a", 7, 8)).to.be.an("array").and.to.be.empty;
                });
            });            
        });
        
        mocha.checkLeaks();
        mocha.run();
    }
);