export const sourceNames=Object.freeze({ikun:'iKun',bf:'暴风',ff:'非凡',lz:'量子',jy:'金鹰',md:'魔都',hn:'红牛',dz:'大众'});
export function isMediaId(value){if(typeof value!=='string')return false;const match=/^([a-z]+)-[1-9]\d{0,8}$/.exec(value);return Boolean(match&&Object.hasOwn(sourceNames,match[1]));}
