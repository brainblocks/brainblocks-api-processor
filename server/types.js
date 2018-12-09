
/* @flow */

export type BigInt = {|
    isZero : () => boolean,
    isNegative : () => boolean,
    add : (BigInt) => BigInt,
    subtract : (BigInt) => BigInt,
    greater : (BigInt) => boolean,
    lesser : (BigInt) => boolean,
    greaterOrEquals : (BigInt) => boolean,
    lesserOrEquals : (BigInt) => boolean,
    equals : (mixed) => boolean
|};
