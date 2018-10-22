define(function() {
    function parseLine(lineStr) {
        try {
            var splitLog = lineStr.split("'"),
                logMetadata = splitLog[0].split(" "),
                logDescription = splitLog[1];
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

    function parseInput(inputStr) {
        return inputStr
            .split("\n")
            .map(parseLine);
    }

    return {
        parseInput: parseInput
    };
})

