class Formula {
    constructor(elements){
        this.elements = elements || []
        this.isFormula = true

        
        let elementsNew = []
        let last = undefined
        elements.forEach(thing=>{
            if(last && last.isFormula && thing.isFormula){
                elementsNew.push(new FSymbol("*"))
            }
            elementsNew.push(thing)
            last = thing
        })
        this.elements = elementsNew
    }

    toString(){
        return "Formula{" + this.elements.map(a=>a.toString()).join(", ") + "}"
    }

    hasVariable(){
        return this.elements.map(a=>{
            if(a.isFormula) return a.hasVariable()
            return (a.isSymbol && a?.getData()?.variable)
        }).includes(true)
    }

    getAsString(){
        let prevElm = undefined
        return this.elements.map(a=>{
            if(prevElm && prevElm.isSymbol && prevElm.getData().isFunction && (a.symbol !== "(" && a.symbol !== ")")){
                prevElm = a
                return "(" + a.getAsString() + ")"
            }
            prevElm = a
            if(a.isFormula) return "(" + a.getAsString() + ")"
            return a?.getAsString() || ""
        }).join("")
    }

    clone(){
        return new Formula(this.elements.map(a=>a.clone()))
    }

    evaluate(variables){
        this.elements = this.elements.map(elm=>{
            if(!elm.isSymbol && !elm.isNumber){//nested formula
                return elm.evaluate(variables).elements[0]
            }
            if(elm.isSymbol && elm?.getData()?.variable) return variables?.[elm.symbol] || 0
            return elm
        })

        let iters = 0
        while(this.elements.length > 1 && iters < 10000){//no infin loops today!
            let newElements = []
            let prev = undefined
            let next = this.elements[1]
            let done = false
            let nextIsDone = false

            let highestBimLevel = 0
            this.elements.forEach(elm=>{
                if(elm && elm.isSymbol && elm.getData().bimdasLevel > highestBimLevel){
                    highestBimLevel=elm.getData().bimdasLevel
                }
            })

            this.elements.forEach((elm, i)=>{
                if(done && !nextIsDone) newElements.push(elm)
                nextIsDone = false
                if(done) return
                next = this.elements[i+1]

                if(elm && elm.isSymbol && elm.getData().bimdasLevel === highestBimLevel){

                    let data = elm.getData()

                    let args = data.args.map(a=>{
                        if(a === "prev") return prev
                        if(a === "next") return next
                    })

                    if(!data.args.includes("prev")){
                        if(prev !== undefined){
                            newElements.push(prev)
                        }
                    }

                    if(!args.includes(undefined) && !args.map(a=>!!a.isNumber).includes(false)){
                        prev = new FNumber(data["func"](...args))
                    }
                    done = true
                    next = undefined
                    nextIsDone=true
                }

                if(prev !== undefined){
                    newElements.push(prev)
                }

                prev = elm
            })

            this.elements = newElements
            iters++
        }

        return this
    }

    static loadFromString(input){

        let sbc = input.split("(").length
        let ebc = input.split(")").length
        if(sbc > ebc){
            input += ")".repeat(sbc-ebc)
        }

        input = input.split("")

        let alalizedThings = []

        let currNumberStr = ""
        let currSymbolStr = ""

        function endNumStr(){
            alalizedThings.push(new FNumber(parseFloat(currNumberStr)))
            currNumberStr = ""
        }
        function endSymbolStr(){
            if(symbols[currSymbolStr.toLowerCase()].rawValue){
                alalizedThings.push(new FNumber(symbols[currSymbolStr.toLowerCase()].rawValue))
            }else{
                alalizedThings.push(new FSymbol(currSymbolStr.toLowerCase()))
            }
            currSymbolStr = ""
        }
        for(let char of input){
            if(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "."].includes(char) && !currSymbolStr){
                currNumberStr += char
                continue
            }

            if(currNumberStr){ //end number
                endNumStr()
            }

            currSymbolStr += char
            if(Object.keys(symbols).includes(currSymbolStr.toLowerCase())){
                endSymbolStr()
            }
        }
        if(currNumberStr){ //end number
            endNumStr()
        }

        let alalizedThingsNew = []
        let last = undefined
        alalizedThings.forEach(thing=>{
            if(last && (((last.isNumber) && (((thing.isSymbol && thing.symbol !== ")" && !(thing.getData()?.args?.includes("prev")||false))) || thing.isNumber)))){
                alalizedThingsNew.push(new FSymbol("*"))
            }
            if(last && last.isFormula && thing.isFormula){
                alalizedThingsNew.push(new FSymbol("*"))
            }
            alalizedThingsNew.push(thing)
            last = thing
        })
        alalizedThings = alalizedThingsNew

        //now we have it all escaped into symbols
        //create bimdas stuff

        //brackets
        let tree = []
        let treeLoc = []
        function getElms(){
            let _tree = tree
            treeLoc.forEach(n=>{
                _tree = _tree?.[n] || _tree.elements[n]
            })
            return _tree.elements || _tree
        }
        alalizedThings.forEach(thing=>{
            if(thing.symbol === "("){
                let newLoc = getElms().length
                getElms().push(new Formula([]))
                treeLoc.push(newLoc)
                return
            }
            if(thing.symbol===")"){
                treeLoc.pop()
                return
            }

            getElms().push(thing)
        })

        return new Formula(tree)
    }
}


class FNumber {
    constructor(number){
        this.number = number
        this.isNumber = true
    }

    getAsString(){
        return Math.round(this.number*10000000)/10000000
    }

    toString(){
        return "FNumber{" + this.number + "}"
    }

    clone(){
        return new FNumber(this.number)
    }
}

let functionBimdasLevel= 100
let symbols = {
    // "=": {
    //     "func": (prev, next)=>{
    //         return prev.number+next.number
    //     },
    //     "args": ["allPrev", "allNext"],
    //     "bimdasLevel": -10
    // },
    "+": {
        "func": (prev, next)=>{
            return prev.number+next.number
        },
        "args": ["prev", "next"],
        "bimdasLevel": 1
    },
    "-": {
        "func": (prev, next)=>{
            if(!prev) return 0-next.number
            return prev.number-next.number
        },
        "args": ["prev", "next"],
        "bimdasLevel": 1
    },
    "*": {
        "func": (prev, next)=>{
            return prev.number*next.number
        },
        "args": ["prev", "next"],
        "bimdasLevel": 2
    },
    "/": {
        "func": (prev, next)=>{
            return prev.number/next.number
        },
        "args": ["prev", "next"],
        "bimdasLevel": 2
    },
    "^": {
        "func": (prev, next)=>{
            return Math.pow(prev.number,next.number)
        },
        "args": ["prev", "next"],
        "bimdasLevel": 3
    },
    "!": {
        "func": (prev)=>{
            function factorial(op) {
            // Lanczos Approximation of the Gamma Function
            // As described in Numerical Recipes in C (2nd ed. Cambridge University Press, 1992)
            var z = op + 1;
            var p = [1.000000000190015, 76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 1.208650973866179E-3, -5.395239384953E-6];
           
            var d1 = Math.sqrt(2 * Math.PI) / z;
            var d2 = p[0];
           
            for (var i = 1; i <= 6; ++i)
             d2 += p[i] / (z + i);
           
            var d3 = Math.pow((z + 5.5), (z + 0.5));
            var d4 = Math.exp(-(z + 5.5));
           
            d = d1 * d2 * d3 * d4;
           
            return d;
           }
              return factorial(prev.number)
        },
        "args": ["prev"],
        "bimdasLevel": 3
    },
    "pi": {
        "rawValue": Math.PI
    },
    "e": {
        "rawValue": Math.E
    },
    "x": {
        "variable": true
    },
    "(": {
        "func": undefined
    },
    ")": {
        "func": undefined
    },
    "ln": {
        "func": (next)=>{
            return Math.log(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        
        "bimdasLevel": functionBimdasLevel
    },
    "random": {
        "func": (next)=>{
            return Math.random()*(next?.number || 1)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "log": {
        "func": (next)=>{
            return Math.log(next.number)/Math.log(10)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "iteratedlog": {
        "func": (next)=>{
            let num = next.number
            let res = 0
            while(num>1){
                num = log(num)/log(Math.E)
                res++
            }
            return res
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "sqrt": {
        "func": (next)=>{
            return Math.sqrt(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "sin": {
        "func": (next)=>{
            return Math.sin(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "cos": {
        "func": (next)=>{
            return Math.cos(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "tan": {
        "func": (next)=>{
            return Math.tan(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "asin": {
        "func": (next)=>{
            return Math.asin(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "acos": {
        "func": (next)=>{
            return Math.acos(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "atan": {
        "func": (next)=>{
            return Math.atan(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "sinh": {
        "func": (next)=>{
            return Math.sinh(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "cosh": {
        "func": (next)=>{
            return Math.cosh(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "tanh": {
        "func": (next)=>{
            return Math.tanh(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "asinh": {
        "func": (next)=>{
            return Math.asinh(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "acosh": {
        "func": (next)=>{
            return Math.acosh(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    },
    "atanh": {
        "func": (next)=>{
            return Math.atanh(next.number)
        },
        "isFunction": true,
        "args": ["next"],
        "bimdasLevel": functionBimdasLevel
    }
}

class FSymbol {
    constructor(symbol){
        this.symbol = symbol
        this.isSymbol = true
    }

    getData(){
        return symbols[this.symbol]
    }

    getAsString(){
        return this.symbol
    }

    toString(){
        return "FSymbol{" + this.symbol + "}"
    }

    clone(){
        return new FSymbol(this.symbol)
    }
}