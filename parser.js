import {argv} from 'node:process';
import fs from 'node:fs';
import BPMNModdle from 'bpmn-moddle';
import ejs from 'ejs';

const bpmnText = fs.readFileSync(argv[2], {encoding:'utf8', flag:'r'});
var template = fs.readFileSync('templates/main.ejs', 'utf-8');
const bpmnModdle = new BPMNModdle();
const is = (element, type) => element.$instanceOf(type);

bpmnModdle
.fromXML(bpmnText)
// , (err, definitions) => {
//     console.log("xx");
//     console.log(definitions);
// })
.then(bpmn => {
    console.log(bpmn.rootElement.rootElements[0].flowElements);


    
    let traverse = (curr, visited) => {
        
    };

    let elements = bpmn.rootElement.rootElements[0].flowElements;

    let activities = elements.filter(e => is(e, "bpmn:Activity"));
    let events = elements.filter(e => is(e, "bpmn:Event"));

    let flows = elements.filter(e => is(e, "bpmn:SequenceFlow"));

    console.log("ACTIVITIES\n============\n", activities);
    console.log("EVENTS\n============\n", events);
    console.log("SEQUENCEFLOW\n========", flows);

    flows.forEach(f => {
        console.log(f.sourceRef.id, "\t->\t", f.targetRef.id);
    });


    let idMap = elements.filter(e => is(e, "bpmn:FlowNode"))
        .reduce((acc, e) => { return {...acc, [e.id]: e} }, {});
    let adjList = elements.filter(e => is(e, "bpmn:SequenceFlow"))
        .reduce((acc, f) => {
            return {...acc, [f.sourceRef.id]: [...(acc[f.sourceRef.id] || []), f.targetRef.id]}
        }, {});

    console.log(idMap);
    console.log(adjList);
});


// console.log(ejs.render(template, { processName: 'Order to cash'}));

