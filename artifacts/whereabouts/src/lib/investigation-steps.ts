export type InvestigationStep=1|2|3;
export function advanceInvestigationStep(step:InvestigationStep,count:number):InvestigationStep{return step===1?(count>0?2:1):3;}
export function canSubmitInvestigation(step:InvestigationStep,count:number,busy:boolean){return step===3&&count>0&&!busy;}
export function movePrint<T extends {id:string}>(items:T[],id:string,to:number){const from=items.findIndex(item=>item.id===id);if(from<0)return items;const result=[...items],[item]=result.splice(from,1);result.splice(Math.max(0,Math.min(result.length,to)),0,item);return result;}
