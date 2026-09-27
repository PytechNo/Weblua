import type { RuntimeFlavor } from "../../lib/types";

/**
 * The standard library of every Weblua runtime, as the runtimes really ship it.
 * stdlib.test.ts checks this list against each engine in both directions, so a
 * version bump that adds or drops a name fails the suite until it is updated.
 */
export interface StdlibEntry {
  /** Dotted path: "print", "string.format", "math.pi". */
  name: string;
  /** Flavors that provide this entry. */
  flavors: ReadonlySet<RuntimeFlavor>;
  kind: "function" | "library" | "value";
  /** Parameter list in Lua manual style, e.g. "(s, i [, j])". Functions only. */
  params?: string;
  doc: string;
}

const FLAVOR_CODES: Record<string, RuntimeFlavor> = {
  "1": "lua51",
  "2": "lua52",
  "3": "lua53",
  "4": "lua54",
  "5": "lua55",
  u: "luau"
};

export const FLAVOR_LABELS: Record<RuntimeFlavor, string> = {
  lua51: "Lua 5.1",
  lua52: "Lua 5.2",
  lua53: "Lua 5.3",
  lua54: "Lua 5.4",
  lua55: "Lua 5.5",
  luau: "Luau"
};

const ALL = "12345u";
const LUA = "12345";

// [name, flavors, params (null for non-functions), doc]. Flavor codes: 1-5 are
// Lua 5.1-5.5, u is Luau. A name whose meaning differs between versions has
// one row per meaning.
type Row = [string, string, string | null, string];

const ROWS: Row[] = [
  // Base library
  ["_G", ALL, null, "The global environment table."],
  ["_VERSION", ALL, null, 'The interpreter version, such as "Lua 5.4" or "Luau".'],
  ["assert", ALL, "(v [, message])", "Raises an error if v is false or nil; otherwise returns all its arguments."],
  ["collectgarbage", LUA, "([opt [, arg]])", 'Controls the garbage collector: "collect", "count", "step", and more.'],
  ["dofile", LUA, "([filename])", "Runs a Lua file and returns its results."],
  ["error", ALL, "(message [, level])", "Raises an error. Level 1 (the default) adds the position where error was called."],
  ["gcinfo", "1u", "()", "Returns the memory in use, in kilobytes. Deprecated."],
  ["getfenv", "1u", "([f])", "Returns the environment table of a function or stack level."],
  ["getmetatable", ALL, "(object)", "Returns the metatable of object, or its __metatable field if set."],
  ["ipairs", ALL, "(t)", "Iterates index–value pairs t[1], t[2], ... up to the first nil."],
  ["load", LUA, "(chunk [, chunkname [, mode [, env]]])", "Compiles a chunk without running it. Returns the function, or nil plus an error message."],
  ["loadfile", LUA, "([filename [, mode [, env]]])", "Compiles a file without running it."],
  ["loadstring", "12", "(string [, chunkname])", "Compiles a string without running it. Replaced by load in Lua 5.2."],
  ["module", "12", "(name [, ...])", "Creates a module table in the Lua 5.1 style. Deprecated in Lua 5.2."],
  ["newproxy", "1u", "([addmeta])", "Creates an empty userdata, optionally with its own metatable."],
  ["next", ALL, "(t [, index])", "Returns the key and value that follow index in t, or nil at the end."],
  ["pairs", ALL, "(t)", "Iterates over every key–value pair of t, in no particular order."],
  ["pcall", ALL, "(f, ...)", "Calls f in protected mode. Returns true plus f's results, or false plus the error."],
  ["print", ALL, "(...)", "Writes its arguments to standard output, separated by tabs."],
  ["rawequal", ALL, "(a, b)", "Compares a and b without invoking __eq."],
  ["rawget", ALL, "(t, k)", "Reads t[k] without invoking __index."],
  ["rawlen", "2345u", "(v)", "Returns the length of a table or string without invoking __len."],
  ["rawset", ALL, "(t, k, v)", "Sets t[k] = v without invoking __newindex, and returns t."],
  ["read", "u", "([format])", 'Weblua: reads the preset Input panel. "*l" reads a line (the default), "*L" keeps its newline, "*a" reads the rest.'],
  ["require", ALL, "(modname)", "Loads a project module once and returns its value; later calls return the cached value."],
  ["select", ALL, "(index, ...)", 'Returns the arguments after index, or their count when index is "#".'],
  ["setfenv", "1u", "(f, table)", "Sets the environment table of a function or stack level."],
  ["setmetatable", ALL, "(t, metatable)", "Sets the metatable of t and returns t."],
  ["tonumber", ALL, "(e [, base])", "Converts e to a number, or returns nil if it cannot."],
  ["tostring", ALL, "(v)", "Converts v to a string, honoring __tostring."],
  ["type", ALL, "(v)", 'Returns the basic type of v: "nil", "number", "string", "table", "function", and so on.'],
  ["typeof", "u", "(v)", "Like type, but reports the __type metatable field of userdata."],
  ["unpack", "12u", "(list [, i [, j]])", "Returns list[i] through list[j]. Moved to table.unpack in Lua 5.2."],
  ["warn", "45", "(msg1, ...)", 'Emits a warning built from the concatenated arguments. "@on" and "@off" toggle warnings.'],
  ["warn", "u", "(...)", "Weblua: writes its arguments to standard error."],
  ["xpcall", ALL, "(f, msgh [, ...])", "Calls f in protected mode, passing any error through the handler msgh."],

  // Libraries
  ["string", ALL, null, "String manipulation and pattern matching."],
  ["table", ALL, null, "Table and array manipulation."],
  ["math", ALL, null, "Mathematical functions and constants."],
  ["os", ALL, null, "Time and date functions, plus operating-system access where the host has one."],
  ["io", LUA, null, "Input and output through file handles. Standard input is the preset Input panel."],
  ["coroutine", ALL, null, "Create, resume, and yield coroutines."],
  ["package", LUA, null, "Module loading configuration used by require."],
  ["utf8", "345u", null, "Basic UTF-8 support."],
  ["bit32", "23u", null, "Bitwise operations on 32-bit integers."],
  ["debug", ALL, null, "Introspection and debugging functions."],
  ["buffer", "u", null, "Fixed-size mutable byte buffers."],
  ["vector", "u", null, "The native 3-component vector type."],
  ["task", "u", null, "Weblua: schedule coroutines, as in Roblox, Lune, and Lute. Waits use real time."],

  // string
  ["string.byte", ALL, "(s [, i [, j]])", "Returns the numeric codes of the characters s[i] through s[j]."],
  ["string.char", ALL, "(...)", "Builds a string from numeric character codes."],
  ["string.dump", LUA, "(function [, strip])", "Returns the binary chunk of a Lua function."],
  ["string.find", ALL, "(s, pattern [, init [, plain]])", "Finds the first match of pattern. Returns its start and end indices, plus any captures."],
  ["string.format", ALL, "(formatstring, ...)", "Formats values with printf-style directives such as %d, %s, %q, and %.2f."],
  ["string.gfind", "1", "(s, pattern)", "Old name for string.gmatch, kept for Lua 5.0 code."],
  ["string.gmatch", ALL, "(s, pattern)", "Returns an iterator over each successive match of pattern in s."],
  ["string.gsub", ALL, "(s, pattern, repl [, n])", "Replaces matches of pattern with repl (a string, table, or function). Returns the result and the match count."],
  ["string.len", ALL, "(s)", "Returns the length of s in bytes."],
  ["string.lower", ALL, "(s)", "Returns s with its letters in lowercase."],
  ["string.match", ALL, "(s, pattern [, init])", "Returns the captures of the first match of pattern, or the whole match."],
  ["string.pack", "345u", "(fmt, v1, v2, ...)", "Serializes values into a binary string using the format fmt."],
  ["string.packsize", "345u", "(fmt)", "Returns the length of a string produced by string.pack with fmt."],
  ["string.rep", ALL, "(s, n [, sep])", "Returns n copies of s, separated by sep where supported."],
  ["string.reverse", ALL, "(s)", "Returns s reversed."],
  ["string.split", "u", "(s [, separator])", 'Splits s on separator (default ",") and returns an array of the pieces.'],
  ["string.sub", ALL, "(s, i [, j])", "Returns the substring from i to j. Negative indices count from the end."],
  ["string.unpack", "345u", "(fmt, s [, pos])", "Reads values packed with the format fmt from s."],
  ["string.upper", ALL, "(s)", "Returns s with its letters in uppercase."],

  // table
  ["table.clear", "u", "(t)", "Removes every key from t while keeping its allocated capacity."],
  ["table.clone", "u", "(t)", "Returns a shallow copy of t."],
  ["table.concat", ALL, "(list [, sep [, i [, j]]])", "Joins list[i] through list[j] into a string, separated by sep."],
  ["table.create", "5", "(nseq [, nrec])", "Creates an empty table with space preallocated for nseq array and nrec hash entries."],
  ["table.create", "u", "(count [, value])", "Creates an array of count elements, each set to value."],
  ["table.find", "u", "(t, value [, init])", "Returns the index of the first element of t equal to value, or nil."],
  ["table.foreach", "1u", "(t, f)", "Calls f(key, value) for each pair of t. Deprecated."],
  ["table.foreachi", "1u", "(t, f)", "Calls f(index, value) for each array element of t. Deprecated."],
  ["table.freeze", "u", "(t)", "Makes t read-only and returns it."],
  ["table.getn", "1u", "(t)", "Returns the length of t. Deprecated; use #t."],
  ["table.insert", ALL, "(list, [pos,] value)", "Inserts value at pos (default: the end), shifting later elements up."],
  ["table.isfrozen", "u", "(t)", "Returns true if t was frozen with table.freeze."],
  ["table.maxn", "12u", "(t)", "Returns the largest positive numeric key of t, or 0."],
  ["table.move", "345u", "(a1, f, e, t [, a2])", "Copies a1[f] through a1[e] into a2 (default: a1), starting at index t."],
  ["table.pack", "2345u", "(...)", "Returns a table of the arguments with n set to their count."],
  ["table.remove", ALL, "(list [, pos])", "Removes and returns list[pos] (default: the last element), shifting later elements down."],
  ["table.setn", "1", "(t, n)", "Obsolete. Raises an error in Lua 5.1."],
  ["table.sort", ALL, "(list [, comp])", "Sorts list in place. comp(a, b) should return true when a comes before b."],
  ["table.unpack", "2345u", "(list [, i [, j]])", "Returns list[i] through list[j] (default: 1 through #list)."],

  // math
  ["math.abs", ALL, "(x)", "Returns the absolute value of x."],
  ["math.acos", ALL, "(x)", "Returns the arc cosine of x, in radians."],
  ["math.asin", ALL, "(x)", "Returns the arc sine of x, in radians."],
  ["math.atan", ALL, "(y [, x])", "Returns the arc tangent of y (of y/x with two arguments where supported), in radians."],
  ["math.atan2", "123u", "(y, x)", "Returns the arc tangent of y/x, using both signs to find the quadrant."],
  ["math.ceil", ALL, "(x)", "Returns the smallest integral value greater than or equal to x."],
  ["math.clamp", "u", "(x, min, max)", "Returns x limited to the range [min, max]."],
  ["math.cos", ALL, "(x)", "Returns the cosine of x (in radians)."],
  ["math.cosh", "123u", "(x)", "Returns the hyperbolic cosine of x."],
  ["math.deg", ALL, "(x)", "Converts x from radians to degrees."],
  ["math.e", "u", null, "Euler's number, about 2.71828."],
  ["math.exp", ALL, "(x)", "Returns e raised to the power x."],
  ["math.floor", ALL, "(x)", "Returns the largest integral value less than or equal to x."],
  ["math.fmod", ALL, "(x, y)", "Returns the remainder of x / y, rounded toward zero."],
  ["math.frexp", "1235u", "(x)", "Returns m and e such that x = m × 2^e, with 0.5 ≤ |m| < 1."],
  ["math.huge", ALL, null, "A value greater than any other number (positive infinity)."],
  ["math.isfinite", "u", "(x)", "Returns true if x is neither infinite nor NaN."],
  ["math.isinf", "u", "(x)", "Returns true if x is positive or negative infinity."],
  ["math.isnan", "u", "(x)", "Returns true if x is NaN."],
  ["math.ldexp", "1235u", "(m, e)", "Returns m × 2^e."],
  ["math.lerp", "u", "(a, b, t)", "Linearly interpolates from a to b by t."],
  ["math.log", ALL, "(x [, base])", "Returns the logarithm of x: natural, or in base where supported."],
  ["math.log10", "123u", "(x)", "Returns the base-10 logarithm of x."],
  ["math.map", "u", "(x, inmin, inmax, outmin, outmax)", "Maps x from the range [inmin, inmax] to [outmin, outmax]."],
  ["math.max", ALL, "(x, ...)", "Returns the largest argument."],
  ["math.maxinteger", "345", null, "The largest representable integer."],
  ["math.min", ALL, "(x, ...)", "Returns the smallest argument."],
  ["math.mininteger", "345", null, "The smallest representable integer."],
  ["math.mod", "1", "(x, y)", "Old name for math.fmod, kept for Lua 5.0 code."],
  ["math.modf", ALL, "(x)", "Returns the integral and fractional parts of x."],
  ["math.nan", "u", null, "A NaN (not a number) value."],
  ["math.noise", "u", "(x [, y [, z]])", "Returns Perlin noise for the given coordinates, between -1 and 1."],
  ["math.phi", "u", null, "The golden ratio, about 1.61803."],
  ["math.pi", ALL, null, "The value of π."],
  ["math.pow", "123u", "(x, y)", "Returns x raised to the power y. Equivalent to x ^ y."],
  ["math.rad", ALL, "(x)", "Converts x from degrees to radians."],
  ["math.random", ALL, "([m [, n]])", "Returns a pseudo-random float in [0, 1), or an integer in [1, m] or [m, n]."],
  ["math.randomseed", ALL, "([x])", "Seeds the pseudo-random generator."],
  ["math.round", "u", "(x)", "Rounds x to the nearest integer, with halves rounded away from zero."],
  ["math.sign", "u", "(x)", "Returns -1, 0, or 1 according to the sign of x."],
  ["math.sin", ALL, "(x)", "Returns the sine of x (in radians)."],
  ["math.sinh", "123u", "(x)", "Returns the hyperbolic sine of x."],
  ["math.sqrt", ALL, "(x)", "Returns the square root of x."],
  ["math.sqrt2", "u", null, "The square root of 2."],
  ["math.tan", ALL, "(x)", "Returns the tangent of x (in radians)."],
  ["math.tanh", "123u", "(x)", "Returns the hyperbolic tangent of x."],
  ["math.tau", "u", null, "2π, the number of radians in a full turn."],
  ["math.tointeger", "345", "(x)", "Returns x as an integer if it has an exact integer value; otherwise fail (nil)."],
  ["math.type", "345", "(x)", 'Returns "integer" or "float" for a number, or fail (nil) otherwise.'],
  ["math.ult", "345", "(m, n)", "Returns true if integer m is below n when both are compared as unsigned."],

  // os
  ["os.clock", ALL, "()", "Returns elapsed processor time in seconds, for timing code."],
  ["os.date", ALL, "([format [, time]])", 'Formats a time as a string, or as a table with "*t" (UTC with "!*t").'],
  ["os.difftime", ALL, "(t2, t1)", "Returns the number of seconds from t1 to t2."],
  ["os.execute", LUA, "([command])", "Runs a shell command. The browser has no shell, so this reports failure."],
  ["os.exit", LUA, "([code [, close]])", "Terminates the host program."],
  ["os.getenv", LUA, "(varname)", "Returns the value of an environment variable, or nil."],
  ["os.remove", LUA, "(filename)", "Deletes a file."],
  ["os.rename", LUA, "(oldname, newname)", "Renames a file."],
  ["os.setlocale", LUA, "(locale [, category])", "Sets the current locale."],
  ["os.time", ALL, "([table])", "Returns the current time as a number, or the time described by table."],
  ["os.tmpname", LUA, "()", "Returns a file name usable for a temporary file."],

  // io
  ["io.close", LUA, "([file])", "Closes file, or the default output file."],
  ["io.flush", LUA, "()", "Flushes the default output file."],
  ["io.input", LUA, "([file])", "Sets or returns the default input file."],
  ["io.lines", LUA, "([filename, ...])", "Iterates over the lines of a file, or of standard input."],
  ["io.open", LUA, "(filename [, mode])", 'Opens a file in mode ("r", "w", "a", ...). Returns a handle, or nil plus an error.'],
  ["io.output", LUA, "([file])", "Sets or returns the default output file."],
  ["io.popen", LUA, "(prog [, mode])", "Starts a program with a pipe to it. Not available in the browser."],
  ["io.read", LUA, "(...)", 'Reads from standard input using formats such as "l", "n", and "a". Standard input is the Input panel.'],
  ["io.stderr", LUA, null, "The standard error file handle."],
  ["io.stdin", LUA, null, "The standard input file handle."],
  ["io.stdout", LUA, null, "The standard output file handle."],
  ["io.tmpfile", LUA, "()", "Opens a temporary file for reading and writing."],
  ["io.type", LUA, "(obj)", 'Returns "file", "closed file", or nil if obj is not a file handle.'],
  ["io.write", LUA, "(...)", "Writes its arguments to the default output file."],

  // coroutine
  ["coroutine.close", "45u", "(co)", "Closes a suspended or dead coroutine. Returns true, or false plus an error."],
  ["coroutine.create", ALL, "(f)", "Creates a coroutine that will run f, and returns it."],
  ["coroutine.isyieldable", "345u", "()", "Returns true if the running code can yield."],
  ["coroutine.resume", ALL, "(co, ...)", "Starts or continues co. Returns true plus yielded values, or false plus an error."],
  ["coroutine.running", ALL, "()", "Returns the running coroutine."],
  ["coroutine.status", ALL, "(co)", 'Returns "running", "suspended", "normal", or "dead".'],
  ["coroutine.wrap", ALL, "(f)", "Creates a coroutine and returns a function that resumes it, raising any error."],
  ["coroutine.yield", ALL, "(...)", "Suspends the running coroutine, passing values back to resume."],

  // package
  ["package.config", LUA, null, "Describes the directory separator and path templates used by require."],
  ["package.cpath", LUA, null, "The search path for C modules."],
  ["package.loaded", LUA, null, "Modules already loaded by require, keyed by name."],
  ["package.loaders", "12", null, "The searchers require uses to find modules (Lua 5.1 name)."],
  ["package.loadlib", LUA, "(libname, funcname)", "Links a C library dynamically. Not available in the browser."],
  ["package.path", LUA, null, "The search path for Lua modules."],
  ["package.preload", LUA, null, "Loader functions for specific module names, checked first by require."],
  ["package.searchers", "2345", null, "The searchers require uses to find modules."],
  ["package.searchpath", "2345", "(name, path [, sep [, rep]])", "Searches path for name and returns the first file that exists."],
  ["package.seeall", "12", "(module)", "Makes a module table inherit from the global environment."],

  // utf8
  ["utf8.char", "345u", "(...)", "Builds a UTF-8 string from codepoints."],
  ["utf8.charpattern", "345u", null, "A pattern matching exactly one UTF-8 byte sequence."],
  ["utf8.codepoint", "345u", "(s [, i [, j]])", "Returns the codepoints of the characters between byte positions i and j."],
  ["utf8.codes", "345u", "(s)", "Iterates over the byte position and codepoint of each character."],
  ["utf8.len", "345u", "(s [, i [, j]])", "Returns the number of characters in s, or fail plus the position of an invalid byte."],
  ["utf8.offset", "34u", "(s, n [, i])", "Returns the byte position where the n-th character starts."],
  ["utf8.offset", "5", "(s, n [, i])", "Returns the byte positions where the n-th character starts and ends."],

  // bit32
  ["bit32.arshift", "23u", "(x, disp)", "Shifts x right by disp bits, filling with the sign bit."],
  ["bit32.band", "23u", "(...)", "Returns the bitwise AND of its arguments."],
  ["bit32.bnot", "23u", "(x)", "Returns the bitwise NOT of x."],
  ["bit32.bor", "23u", "(...)", "Returns the bitwise OR of its arguments."],
  ["bit32.btest", "23u", "(...)", "Returns true if the bitwise AND of its arguments is not zero."],
  ["bit32.bxor", "23u", "(...)", "Returns the bitwise XOR of its arguments."],
  ["bit32.byteswap", "u", "(n)", "Reverses the byte order of n."],
  ["bit32.countlz", "u", "(n)", "Returns the number of consecutive zero bits from the top of n."],
  ["bit32.countrz", "u", "(n)", "Returns the number of consecutive zero bits from the bottom of n."],
  ["bit32.extract", "23u", "(n, field [, width])", "Returns bits field through field + width - 1 of n."],
  ["bit32.lrotate", "23u", "(x, disp)", "Rotates x left by disp bits."],
  ["bit32.lshift", "23u", "(x, disp)", "Shifts x left by disp bits."],
  ["bit32.replace", "23u", "(n, v, field [, width])", "Returns n with bits field through field + width - 1 replaced by v."],
  ["bit32.rrotate", "23u", "(x, disp)", "Rotates x right by disp bits."],
  ["bit32.rshift", "23u", "(x, disp)", "Shifts x right by disp bits, filling with zeros."],

  // debug
  ["debug.debug", LUA, "()", "Enters an interactive debug console. Not usable in the playground."],
  ["debug.getfenv", "1", "(o)", "Returns the environment of o."],
  ["debug.gethook", LUA, "([thread])", "Returns the current hook function, mask, and count."],
  ["debug.getinfo", LUA, "([thread,] f [, what])", "Returns a table of information about a function or stack level."],
  ["debug.getlocal", LUA, "([thread,] f, local)", "Returns the name and value of a local variable."],
  ["debug.getmetatable", LUA, "(value)", "Returns the metatable of value, ignoring __metatable."],
  ["debug.getregistry", LUA, "()", "Returns the registry table."],
  ["debug.getupvalue", LUA, "(f, up)", "Returns the name and value of upvalue up of f."],
  ["debug.getuservalue", "2345", "(u [, n])", "Returns the user value associated with userdata u."],
  ["debug.info", "u", "([thread,] level_or_function, options)", 'Returns details about a stack level or function: "s" source, "l" line, "n" name, "a" arity, "f" function.'],
  ["debug.setcstacklimit", "4", "(limit)", "Deprecated: sets the C stack limit."],
  ["debug.setfenv", "1", "(o, table)", "Sets the environment of o."],
  ["debug.sethook", LUA, "([thread,] hook, mask [, count])", "Sets a function called on calls, returns, lines, or every count instructions."],
  ["debug.setlocal", LUA, "([thread,] level, local, value)", "Assigns value to a local variable of a stack level."],
  ["debug.setmetatable", LUA, "(value, table)", "Sets the metatable of value, which may be any type."],
  ["debug.setupvalue", LUA, "(f, up, value)", "Assigns value to upvalue up of f."],
  ["debug.setuservalue", "2345", "(udata, value [, n])", "Sets the user value associated with userdata udata."],
  ["debug.traceback", ALL, "([thread,] [message [, level]])", "Returns message followed by a traceback of the call stack."],
  ["debug.upvalueid", "2345", "(f, n)", "Returns a unique identifier for upvalue n of f."],
  ["debug.upvaluejoin", "2345", "(f1, n1, f2, n2)", "Makes upvalue n1 of f1 refer to upvalue n2 of f2."],

  // buffer
  ["buffer.copy", "u", "(target, targetOffset, source [, sourceOffset [, count]])", "Copies count bytes from source into target."],
  ["buffer.create", "u", "(size)", "Creates a buffer of size bytes, all zero."],
  ["buffer.fill", "u", "(b, offset, value [, count])", "Sets count bytes starting at offset to value."],
  ["buffer.fromstring", "u", "(s)", "Creates a buffer holding the bytes of s."],
  ["buffer.len", "u", "(b)", "Returns the size of b in bytes."],
  ["buffer.readbits", "u", "(b, bitOffset, bitCount)", "Reads bitCount bits starting at bitOffset as an unsigned integer."],
  ["buffer.readf32", "u", "(b, offset)", "Reads a 32-bit float at offset."],
  ["buffer.readf64", "u", "(b, offset)", "Reads a 64-bit float at offset."],
  ["buffer.readi16", "u", "(b, offset)", "Reads a signed 16-bit integer at offset."],
  ["buffer.readi32", "u", "(b, offset)", "Reads a signed 32-bit integer at offset."],
  ["buffer.readi8", "u", "(b, offset)", "Reads a signed 8-bit integer at offset."],
  ["buffer.readstring", "u", "(b, offset, count)", "Reads count bytes at offset as a string."],
  ["buffer.readu16", "u", "(b, offset)", "Reads an unsigned 16-bit integer at offset."],
  ["buffer.readu32", "u", "(b, offset)", "Reads an unsigned 32-bit integer at offset."],
  ["buffer.readu8", "u", "(b, offset)", "Reads an unsigned 8-bit integer at offset."],
  ["buffer.tostring", "u", "(b)", "Returns the contents of b as a string."],
  ["buffer.writebits", "u", "(b, bitOffset, bitCount, value)", "Writes the low bitCount bits of value starting at bitOffset."],
  ["buffer.writef32", "u", "(b, offset, value)", "Writes a 32-bit float at offset."],
  ["buffer.writef64", "u", "(b, offset, value)", "Writes a 64-bit float at offset."],
  ["buffer.writei16", "u", "(b, offset, value)", "Writes a signed 16-bit integer at offset."],
  ["buffer.writei32", "u", "(b, offset, value)", "Writes a signed 32-bit integer at offset."],
  ["buffer.writei8", "u", "(b, offset, value)", "Writes a signed 8-bit integer at offset."],
  ["buffer.writestring", "u", "(b, offset, value [, count])", "Writes value (or its first count bytes) at offset."],
  ["buffer.writeu16", "u", "(b, offset, value)", "Writes an unsigned 16-bit integer at offset."],
  ["buffer.writeu32", "u", "(b, offset, value)", "Writes an unsigned 32-bit integer at offset."],
  ["buffer.writeu8", "u", "(b, offset, value)", "Writes an unsigned 8-bit integer at offset."],

  // task (provided by Weblua's scheduler)
  ["task.cancel", "u", "(thread)", "Stops a scheduled or waiting thread so it never resumes."],
  ["task.defer", "u", "(f_or_thread, ...)", "Runs f (or resumes thread) once the current thread yields or finishes. Returns the thread."],
  ["task.delay", "u", "(seconds, f_or_thread, ...)", "Runs f (or resumes thread) after seconds. Returns the thread."],
  ["task.spawn", "u", "(f_or_thread, ...)", "Runs f (or resumes thread) immediately until it first yields. Returns the thread."],
  ["task.wait", "u", "([seconds])", "Yields the current thread for at least seconds (minimum one 60 Hz frame) and returns the time actually waited."],

  // vector
  ["vector.abs", "u", "(v)", "Returns v with each component made positive."],
  ["vector.angle", "u", "(a, b [, axis])", "Returns the angle between a and b in radians, signed around axis if given."],
  ["vector.ceil", "u", "(v)", "Rounds each component up."],
  ["vector.clamp", "u", "(v, min, max)", "Clamps each component between the matching components of min and max."],
  ["vector.create", "u", "(x, y [, z])", "Creates a vector."],
  ["vector.cross", "u", "(a, b)", "Returns the cross product of a and b."],
  ["vector.dot", "u", "(a, b)", "Returns the dot product of a and b."],
  ["vector.floor", "u", "(v)", "Rounds each component down."],
  ["vector.lerp", "u", "(a, b, t)", "Linearly interpolates from a to b by t."],
  ["vector.magnitude", "u", "(v)", "Returns the length of v."],
  ["vector.max", "u", "(...)", "Returns the component-wise maximum of its arguments."],
  ["vector.min", "u", "(...)", "Returns the component-wise minimum of its arguments."],
  ["vector.normalize", "u", "(v)", "Returns v scaled to length 1."],
  ["vector.one", "u", null, "The vector (1, 1, 1)."],
  ["vector.sign", "u", "(v)", "Returns the sign (-1, 0, or 1) of each component."],
  ["vector.zero", "u", null, "The vector (0, 0, 0)."]
];

function parseFlavors(codes: string): Set<RuntimeFlavor> {
  const flavors = new Set<RuntimeFlavor>();
  for (const code of codes) {
    const flavor = FLAVOR_CODES[code];
    if (!flavor) throw new Error(`Unknown flavor code ${code}`);
    flavors.add(flavor);
  }
  return flavors;
}

export const STDLIB: readonly StdlibEntry[] = ROWS.map(([name, codes, params, doc]) => ({
  name,
  flavors: parseFlavors(codes),
  kind: params !== null ? "function" : name.includes(".") ? "value" : isLibraryRow(name) ? "library" : "value",
  ...(params !== null ? { params } : {}),
  doc
}));

function isLibraryRow(name: string): boolean {
  return ROWS.some(([other]) => other.startsWith(`${name}.`));
}

const byFlavor = new Map<RuntimeFlavor, Map<string, StdlibEntry>>();

/** Every entry the flavor provides, keyed by dotted name. */
export function stdlibFor(flavor: RuntimeFlavor): ReadonlyMap<string, StdlibEntry> {
  let entries = byFlavor.get(flavor);
  if (!entries) {
    entries = new Map();
    for (const entry of STDLIB) {
      if (entry.flavors.has(flavor)) entries.set(entry.name, entry);
    }
    byFlavor.set(flavor, entries);
  }
  return entries;
}

/** Top-level names (globals and libraries) for a flavor. */
export function stdlibGlobals(flavor: RuntimeFlavor): StdlibEntry[] {
  return [...stdlibFor(flavor).values()].filter((entry) => !entry.name.includes("."));
}

/** Members of one library, such as "string", for a flavor. */
export function stdlibMembers(flavor: RuntimeFlavor, library: string): StdlibEntry[] {
  const prefix = `${library}.`;
  return [...stdlibFor(flavor).values()].filter(
    (entry) => entry.name.startsWith(prefix) && !entry.name.slice(prefix.length).includes(".")
  );
}

/**
 * Flavors that provide a name, however its meaning differs: "Lua 5.3–5.5, Luau".
 * Consecutive Lua versions collapse into a range.
 */
export function availabilityLabel(name: string): string {
  const flavors = new Set<RuntimeFlavor>();
  for (const entry of STDLIB) {
    if (entry.name === name) entry.flavors.forEach((flavor) => flavors.add(flavor));
  }

  const versions = (["lua51", "lua52", "lua53", "lua54", "lua55"] as const)
    .filter((flavor) => flavors.has(flavor))
    .map((flavor) => Number(flavor.slice(3)));
  const parts: string[] = [];
  for (let index = 0; index < versions.length; ) {
    let end = index;
    while (end + 1 < versions.length && versions[end + 1] === versions[end] + 1) end += 1;
    const first = `5.${versions[index] - 50}`;
    const last = `5.${versions[end] - 50}`;
    parts.push(index === end ? `Lua ${first}` : `Lua ${first}–${last}`);
    index = end + 1;
  }
  if (flavors.has("luau")) parts.push("Luau");
  return parts.join(", ");
}

/** Reserved words and contextual keywords each flavor's grammar recognizes. */
export function keywordsFor(flavor: RuntimeFlavor): string[] {
  const keywords = [
    "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if", "in",
    "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while"
  ];
  if (flavor !== "lua51" && flavor !== "luau") keywords.push("goto");
  if (flavor === "lua55") keywords.push("global");
  if (flavor === "luau") keywords.push("continue", "type", "export");
  return keywords;
}

/** Luau's builtin type names, offered in type annotations. */
export const LUAU_BUILTIN_TYPES = [
  "any", "boolean", "buffer", "never", "nil", "number", "string", "thread", "unknown", "userdata", "vector"
];
