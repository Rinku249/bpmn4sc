import { argv } from 'node:process';
import fs from 'node:fs';
import BPMNModdle from 'bpmn-moddle';
import ejs from 'ejs';
import { type } from 'node:os';


//local imports, first is only the bpmn model in xml text. Others are EJS scripts for correct formatting
const bpmnText = fs.readFileSync(argv[2], { encoding: 'utf8', flag: 'r' }); 
var pure = fs.readFileSync('templates/main.ejs', 'utf-8');
var sequence = fs.readFileSync('templates/child.ejs', 'utf-8');
var exclusive = fs.readFileSync('templates/exclusive.ejs', 'utf-8');
var parallel = fs.readFileSync('templates/parallel.ejs', 'utf-8');

//Flow element object used to instatiate elements of the flow tree used to represent the bpmn model
class FlowElement {
    constructor(type, id, name, documentation, nextObjs) {
        this.type = type;
        this.id = id;
        this.name = name;
        this.documentation = documentation;
        this.nextObjs = nextObjs;
    }
}


const bpmnModdle = new BPMNModdle();
const is = (element, type) => element.$instanceOf(type);

bpmnModdle
    .fromXML(bpmnText)
    // , (err, definitions) => {
    //     console.log("xx");
    //     console.log(definitions);
    // })
    .then(bpmn => {
        //console.log(bpmn.rootElement.rootElements[0].flowElements);
        let traverse = (curr, visited) => {

        };

        //import of every single bpmn element in the model
        let elements = bpmn.rootElement.rootElements[0].flowElements;

        //import of elements subdivided in categories, currently unused
        let activities = elements.filter(e => is(e, "bpmn:Activity"));
        let events = elements.filter(e => is(e, "bpmn:Event"));
        let flows = elements.filter(e => is(e, "bpmn:SequenceFlow"));
        let gateways = elements.filter(e => is(e, "bpmn:Gateway"))

        //idMap has the element id, name, documentation and other information
        let idMap = elements.filter(e => is(e, "bpmn:FlowNode")).reduce((acc, e) => { return { ...acc, [e.id]: e } }, {});
        //adjList has the objects that are directly connected to the object you hand in as argument
        let adjList = elements.filter(e => is(e, "bpmn:SequenceFlow")).reduce((acc, f) => { return { ...acc, [f.sourceRef.id]: [...(acc[f.sourceRef.id] || []), f.targetRef.id] } }, {});

        //instantiation of the flowtree
        let tree = Object.keys(adjList).map(f => new FlowElement(idMap[f].$type, idMap[f].id, idMap[f].name ? idMap[f].name : idMap[f].id, idMap[f].documentation ? idMap[f].documentation : null, adjList[f]));
        //remove the first element since its always a start event
        tree.shift()
        //console.log(tree)

        //BPMN -> DAML translator function, only does something when the object in turn is an activity
        tree.map(object => {
            if (object.id[0] === 'A') {
                object.nextObjs.map(next => {
                    var adjutants = Object.assign([], adjList[next])
                    //if the next object in the flow is an activity, just print a simple DAML template pointing at it
                    if (next[0] === 'A') {
                        console.log(ejs.render(sequence, { parent: object, child: idMap[next] }));
                    }
                    //if the next object in the flow is a gateway, check if there are more gateways and what the next activites are in the flow
                    else if (next[0] === 'G') {
                        let currentAdj = adjutants[0]
                        let children = []
                        let gonnaBreak = false
                        while (currentAdj) {
                            if (idMap[currentAdj].id[0] === 'G') {
                                gonnaBreak = false
                                let gatewayObj = idMap[currentAdj]
                                let objs = []
                                while (gatewayObj.id[0] === 'G') {
                                    let len2 = adjList[gatewayObj.id].length
                                    if (len2 > 1) {
                                        for (let j = 0; j < len2; j++) {
                                            if (idMap[adjList[gatewayObj.id]].id[0] === 'G') {
                                                objs.push(idMap[adjList[gatewayObj.id][j]])
                                            }
                                            else {
                                                children.push(idMap[adjList[gatewayObj.id][j]])
                                            }
                                        }
                                    }
                                    else {
                                        if (idMap[adjList[gatewayObj.id][0]].id[0] === 'G') {
                                            objs.push(idMap[adjList[gatewayObj.id][0]])
                                        }
                                        else {
                                            children.push(idMap[adjList[gatewayObj.id][0]])
                                        }
                                    }
                                    gatewayObj = objs.shift()
                                    gonnaBreak = true
                                    if (typeof (gatewayObj) === "undefined") break
                                }
                                if (!gonnaBreak) {
                                    children.push(idMap[currentAdj])
                                }
                            }
                            else {
                                if (idMap[currentAdj][0] === 'E') {
                                    console.log(ejs.render(pure, { activity: object }))
                                }
                                else {
                                    children.push(idMap[currentAdj])
                                }

                            }
                            adjutants.shift()
                            currentAdj = adjutants[0]
                        }
                        let numberOfElements = tree.find(x => x.id === next).nextObjs.length
                        if(idMap[next].$type.split(":")[1][0] === 'E' && numberOfElements > 1){
                            console.log(ejs.render(exclusive, { parent: object, children: children }))
                        }
                        else{ //if(idMap[next].$type.split(":")[1][0] === 'P')
                            console.log(ejs.render(parallel, { parent: object, children: children }))
                        }

                    }
                    //if the next object in the flow is an event, finish the template with a pure, it has no sons
                    else if (next[0] === 'E') {
                        console.log(ejs.render(pure, { activity: object }))
                    }
                });
            }
        });
    });



