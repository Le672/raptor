export function isAppWindow(scope?:any):boolean;
export function observeAppWindow(change:(installed:boolean)=>void,scope?:any):()=>void;
export function applyAppWindowLayout(active:boolean,doc?:Document):void;
