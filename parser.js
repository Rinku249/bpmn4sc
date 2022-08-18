import {argv} from 'node:process';
import fs from 'node:fs';
import BPMNModdle from 'bpmn-moddle';
import ejs from 'ejs';
import { type } from 'node:os';

const bpmnText = fs.readFileSync(argv[2], {encoding:'utf8', flag:'r'}); //argv se pasa al escribir en consola, como en c
var pure = fs.readFileSync('templates/main.ejs', 'utf-8');
var sequence = fs.readFileSync('templates/child.ejs', 'utf-8');
var exclusive = fs.readFileSync('templates/exclusive.ejs', 'utf-8');
var parallel = fs.readFileSync('templates/parallel.ejs', 'utf-8');

class FlowElement {
    constructor(type, id, name, documentation, nextObjs){
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

    let elements = bpmn.rootElement.rootElements[0].flowElements;

    let activities = elements.filter(e => is(e, "bpmn:Activity"));
    let events = elements.filter(e => is(e, "bpmn:Event"));
    let flows = elements.filter(e => is(e, "bpmn:SequenceFlow"));
    let gateways = elements.filter(e => is(e, "bpmn:Gateway"))

    //console.log("ACTIVITIES\n============\n", activities);
    //console.log("EVENTS\n============\n", events);
    //console.log("SEQUENCEFLOW\n========", flows);

    //flows.forEach(f => {console.log(f.sourceRef.id, "\t->\t", f.targetRef.id);});


    let idMap = elements.filter(e => is(e, "bpmn:FlowNode")).reduce((acc, e) => { return {...acc, [e.id]: e} }, {});
    let adjList = elements.filter(e => is(e, "bpmn:SequenceFlow")).reduce((acc, f) => { return {...acc, [f.sourceRef.id]: [...(acc[f.sourceRef.id] || []), f.targetRef.id]}}, {});

    //console.log(idMap);
    //console.log(adjList);

    
    let tree = Object.keys(adjList).map(f => new FlowElement(idMap[f].$type, idMap[f].id, idMap[f].name ? idMap[f].name : idMap[f].id, idMap[f].documentation ? idMap[f].documentation : null , adjList[f]));
    //tree = new FlowElement(idMap['Event_1s935vj'].$type,idMap['Event_1s935vj'].id,idMap['Event_1s935vj'].name ? idMap['Event_1s935vj'].name : null,idMap['Event_1s935vj'].documentation ? idMap['Event_1s935vj'].documentation : null ,adjList['Event_1s935vj'])
    tree.shift()
    //console.log(tree)

    recall = tree.map(object => {
        if (object.id[0] === 'A'){
            object.nextObjs.map(next => {
                if (next[0] === 'A'){
                console.log(ejs.render(sequence, { parent: object, child: idMap[next]}));
                }
                else if (next[0] === 'G'){
                    let len = adjList[next].length
                    if(idMap[next].$type.split(":")[1][0] === 'E'){
                        console.log(ejs.render(exclusive, {parent: object, child1: idMap[adjList[next][0]], child2: idMap[adjList[next][1]]}))
                    }
                    else if(idMap[next].$type.split(":")[1][0] === 'P'){
                        if(adjList[next].length > 1){
                            let children = []
                            //console.log(idMap[adjList[next][1]].id)
                            //console.log(adjList[idMap[adjList[next][1]].id])
                            //console.log(ejs.render(parallel, {parent: object, child1: idMap[adjList[next][0]], child2: idMap[adjList[next][1]]}))
                            for(let i = 0 ; i<len ; i++){
                                if(idMap[adjList[next][i]].id[0] === 'G'){
                                    let len2 = adjList[idMap[adjList[next][i]].id].length
                                    if(len2 > 1){
                                        for (let j = 0; j < len2 ; j++){
                                            children.push(idMap[adjList[idMap[adjList[next][i]].id][j]])
                                        }
                                    }
                                    else{
                                        children.push(idMap[adjList[idMap[adjList[next][i]].id][0]])
                                    }
                                    continue
                                }
                                children.push(idMap[adjList[next][i]])
                            }
                            console.log(ejs.render(parallel, {parent: object, children: children}))
                        }
                        else{
                            if(idMap[adjList[next][0]][0] === 'E'){
                                console.log(ejs.render(pure, {activity: object}))
                            }
                            else{
                                //console.log(idMap[adjList[next][0]])
                                console.log(ejs.render(sequence, {parent: object, child: idMap[adjList[next][0]]}))
                            }

                        }
                    }
                }
                else if (next[0] === 'E'){
                    console.log(ejs.render(pure, {activity: object}))
                }
            });
        }
    });
    
    
    //console.log(activities.map(a => ejs.render(template, { activity: a })).join("\n"))

    /*
    let b = activities.map(a => {
        if (adjList[a.id][0][0] === 'A'){
            console.log(ejs.render(sequence, {parent: idMap[adjList[a.id]], child: a}));
        }
        else if (adjList[a.id][0][0] === 'G'){
            if(idMap[adjList[a.id]].$type.split(":")[1][0] === 'E'){
                console.log(ejs.render(exclusive, {parent: a, child1: idMap[adjList[idMap[adjList[a.id]].id][0]], child2: idMap[adjList[idMap[adjList[a.id]].id][1]] }));
            }
            else if(idMap[adjList[a.id]].$type.split(":")[1][0] === 'P'){
                if(adjList[idMap[adjList[a.id]].id].length > 1){
                    console.log(ejs.render(parallel, {parent: a, child1: idMap[adjList[idMap[adjList[a.id]].id][0]], child2: idMap[adjList[idMap[adjList[a.id]].id][1]] }));
                }
            }
        };
    });
    */
    

   //console.log(adjList)


    //console.log(ejs.render(template2, {parent: b, child: a}))
});


//console.log(ejs.render(template, { processName: 'Order to cash'}));

