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
var event = fs.readFileSync('templates/event.ejs', 'utf-8');

//Flow element object used to instatiate elements of the flow tree used to represent the bpmn model
class FlowElement {
    constructor(type, id, name, documentation, nextObjs, lastObjs, signatory) {
        this.type = type;
        this.id = id;
        this.name = name;
        this.documentation = documentation;
        this.nextObjs = nextObjs;
        this.lastObjs = lastObjs;
        this.signatory = signatory;
    }
}


const bpmnModdle = new BPMNModdle();
const is = (element, type) => element.$instanceOf(type);
bpmnModdle.fromXML(bpmnText).then(bpmn => {
        //console.log(bpmn.rootElement.rootElements[0].flowElements);
        let traverse = (curr, visited) => {

        };
        let DAMLFileText = `module Main where\n\nimport DA.List\nimport DA.Optional\nimport Daml.Script\n\n`;
        let hasLanes = false;
        let lanes = undefined;
        let references = undefined;
        //import of every single bpmn element in the model
        let rootElements = bpmn.rootElement.rootElements;
        //console.log(rootElements[1].laneSets[0].lanes[0].flowNodeRefs)
        //console.log(bpmn.references)
        let process = rootElements.find(x => x.$type === "bpmn:Process");
        let elements = process.flowElements;
        //console.log(elements)
        //import of elements subdivided in categories, currently unused
        let activities = elements.filter(e => is(e, "bpmn:Activity"));
        let events = elements.filter(e => is(e, "bpmn:Event"));
        let flows = elements.filter(e => is(e, "bpmn:SequenceFlow"));
        let gateways = elements.filter(e => is(e, "bpmn:Gateway"));
        if(process.laneSets){
            lanes = process.laneSets[0].lanes;
            references = lanes.map(lane => bpmn.references.map(x => (x.element.id === lane.id) ? x.id : null));
            references = references.map(lane => lane.filter(n => n));
            hasLanes = true;
        }
        //idMap has the element id, name, documentation and other information
        let idMap = elements.filter(e => is(e, "bpmn:FlowNode")).reduce((acc, e) => { return { ...acc, [e.id]: e } }, {});
        //adjList has the objects that are directly connected to the object you hand in as argument
        let adjList = elements.filter(e => is(e, "bpmn:SequenceFlow")).reduce((acc, f) => { return { ...acc, [f.sourceRef.id]: [...(acc[f.sourceRef.id] || []), f.targetRef.id] } }, {});
        //lastobjs has a list of the objects that came right before the object you hand in as argument
        let lastObjs = elements.filter(e =>is(e, "bpmn:SequenceFlow")).reduce((acc, l) => { return { ...acc, [l.targetRef.id]: [...(acc[l.targetRef.id] || []), l.sourceRef.id] } }, {});
        //console.log(lastObjs)
        //instantiation of the flowtree
        //console.log(Object.keys(adjList))
        let tree = Object.keys(adjList).map(f => new FlowElement(idMap[f].$type, 
            idMap[f].id, 
            idMap[f].name ? idMap[f].name : idMap[f].id, 
            idMap[f].documentation ? idMap[f].documentation[0].text.replaceAll('\n','\n\t\t') : '', 
            adjList[f],
            lastObjs[f],
            hasLanes ? lanes[references.map(x => x.includes(idMap[f].id)).indexOf(true)].name : "generic")
            );
        //remove the first element since its always a start event
        //console.log(tree)

        //BPMN -> DAML translator function, only does something when the object in turn is an activity
        tree.map(object => {
            //console.log(lastObjs[object.id])
            if (object.id[0] === 'A') {
                object.nextObjs.map(next => {
                    var adjutants = Object.assign([], adjList[next])
                    //if the next object in the flow is an activity, just print a simple DAML template pointing at it
                    if (next[0] === 'A') {
                        let thisChild = tree.find(x => x.id === next)
                        let thisReq = object.documentation.split("\n\t\t")
                        let nextReq = thisChild.documentation.split("\n\t\t")
                        let difReq = nextReq.filter(x => !thisReq.includes(x))
                        let sameReq = thisReq.filter(x => nextReq.includes(x))
                        let equal = true
                        if(difReq.length){
                            equal = false
                        }
                        DAMLFileText += ejs.render(sequence, { parent: object, child: thisChild, thisReq: sameReq, withs: difReq, equal:equal })
                        //console.log(ejs.render(sequence, { parent: object, child: thisChild, last: thisParent }));
                    }
                    //if the next object in the flow is a gateway, check if there are more gateways and what the next activites are in the flow
                    else if (next[0] === 'G') {
                        let currentAdj = adjutants[0]
                        let children = []
                        let events = []
                        let gonnaBreak = false
                        while (currentAdj) {
                            if (currentAdj[0] === 'G') {
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
                                //console.log(object.id + "->" + currentAdj)
                                if (idMap[currentAdj].$type === "bpmn:IntermediateCatchEvent") {
                                    events.push(idMap[currentAdj])
                                    adjutants.push(idMap[adjList[currentAdj][0]].id)
                                }
                                else {
                                    children.push(idMap[currentAdj])
                                }

                            }
                            adjutants.shift()
                            currentAdj = adjutants[0]
                        }
                        let childReqs = children.map(child => {
                            let thisChild = tree.find(x => x.id === child.id)
                            if(!thisChild){
                                return [child]
                            }
                            else{
                                let thisReq = object.documentation.split("\n\t\t")
                                let nextReq = thisChild.documentation.split("\n\t\t")
                                let difReq = nextReq.filter(x => !thisReq.includes(x))
                                let sameReq = thisReq.filter(x => nextReq.includes(x))
                                let equal = true
                                if(difReq.length){
                                    equal = false
                                }
                                return [thisChild, sameReq, difReq, equal]
                            }
                        })
                        let numberOfElements = tree.find(x => x.id === next).nextObjs.length
                        if(idMap[next].$type.split(":")[1] === 'ExclusiveGateway' && numberOfElements > 1){
                            DAMLFileText += ejs.render(exclusive, { parent: object, children: childReqs})
                            //console.log(ejs.render(exclusive, { parent: object, children: children, last: idMap[lastObjs[object.id][0]] }))
                        }
                        else if(idMap[next].$type.split(":")[1][0] === 'P'){
                            DAMLFileText += ejs.render(parallel, { parent: object, children: childReqs})
                            //console.log(ejs.render(parallel, { parent: object, children: children}))
                        }
                        else if(idMap[next].$type.split(":")[1] === 'EventBasedGateway'){
                            DAMLFileText += ejs.render(event, { parent: object, children: childReqs, events: events})
                            //console.log(ejs.render(event, { parent: object, children: children, events: events, last: idMap[lastObjs[object.id][0]]}))
                            //https://discuss.daml.com/t/experimental-bp-dsl/1185
                        }
                        else{
                            DAMLFileText += ejs.render(sequence, { parent: object, child: childReqs[0][0], thisReq: childReqs[0][1], withs: childReqs[0][2], equal:childReqs[0][3] })
                            //console.log(ejs.render(sequence, { parent: object, child: children[0], last: idMap[lastObjs[object.id][0]]}))
                        }
                    }
                    //if the next object in the flow is an event, finish the template without a choice?
                    else if (next[0] === 'E') {
                        DAMLFileText += ejs.render(pure, { parent: object, last: idMap[lastObjs[object.id][0]] }) + "\n\n"
                        //console.log(ejs.render(pure, { parent: object, last: idMap[lastObjs[object.id][0]] }))
                    }
                });
            }
        });
        fs.mkdir("daml_output/daml",{ recursive: true }, (err) => {
            if (err){
                throw err;
            }
            else{
                fs.writeFile("daml_output/daml/Main.daml", DAMLFileText, (err2) => {if (err2) throw (err2)})
                fs.writeFile("daml_output/daml.yaml",`sdk-version: 2.1.1
name: project
source: daml
version: 0.0.1
dependencies:
    - daml-prim
    - daml-stdlib
    - daml-script`, (err2) => {if (err2) throw (err2)})
            }
        })
    });



