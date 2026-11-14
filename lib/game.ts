/**
 * Jungle Digits shared game model and level configuration.
 * Ported from the Java model and LevelConfig responsibilities with OpenAI
 * Codex assistance. See MIGRATION.md for source mapping and acknowledgements.
 * Passwords, session tokens and puzzle solutions remain server-side.
 */
export type User = {name:string;best:number;games:number;coins:number};
export type Leader = User & {isYou?:boolean;rank?:number};
export type Level = {name:string;count:number;time:number;multiplier:number;description:string};
export type Game = {
 level:number;completed:number;score:number;coinsEarned:number;streak:number;
 strikes:number;status:string;deadline:number;serverNow:number;feedback?:string;
 puzzle:{image:string;source:string}|null;config:Level;
};
export const LEVELS: Level[] = [
 {name:"Little Sprout",count:3,time:45,multiplier:1,description:"Find your feet in the grove."},
 {name:"Jungle Explorer",count:5,time:30,multiplier:2,description:"Pick up the pace. Build your streak."},
 {name:"Banana Legend",count:7,time:18,multiplier:3,description:"Three strikes. One legendary finish."},
];