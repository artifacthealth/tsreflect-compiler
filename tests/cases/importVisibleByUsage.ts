import C = require("./classAsExternalModule"); // C is included in declarations, D is not.
import D = require("./classAsExternalModule");

export var a: C;