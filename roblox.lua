local tonumber = tonumber
local string_byte = string.byte
local string_char = string.char
local string_sub = string.sub
local string_gsub = string.gsub
local string_rep = string.rep
local table_concat = table.concat
local table_insert = table.insert
local math_ldexp = math.ldexp
local getfenv = getfenv or function() return _ENV end
local setmetatable = setmetatable
local pcall = pcall
local select = select
local unpack = unpack or table.unpack

local function decodeString(input, startPos, endPos)
    local charCodes = {}
    for i = startPos, endPos do
        charCodes[i - startPos + 1] = string_byte(input, i)
    end
    return string_char(unpack(charCodes))
end

local function readByte()
    local byte = string_byte(input, currentPosition)
    currentPosition = currentPosition + 1
    return byte
end

local function readShort()
    local byte1, byte2 = string_byte(input, currentPosition, currentPosition + 1)
    currentPosition = currentPosition + 2
    return (byte2 * (2 ^ 8)) + byte1
end

local function readInt()
    local byte1, byte2, byte3, byte4 = string_byte(input, currentPosition, currentPosition + 3)
    currentPosition = currentPosition + 4
    return (byte4 * (2 ^ 24)) + (byte3 * (2 ^ 16)) + (byte2 * (2 ^ 8)) + byte1
end

local function readFloat()
    local bytes = {string_byte(input, currentPosition, currentPosition + 3)}
    currentPosition = currentPosition + 4
    local sign = (bytes[1] > 127) and -1 or 1
    local exponent = ((bytes[1] % 128) * 2) + math_floor(bytes[2] / 128)
    local mantissa = ((bytes[2] % 128) * (2 ^ 16)) + (bytes[3] * (2 ^ 8)) + bytes[4]
    mantissa = (mantissa == 0) and 0.0 or (mantissa / (2 ^ 23) + 1.0)
    return sign * math_ldexp(mantissa, exponent - 127)
end

local function readDouble()
    local bytes = {string_byte(input, currentPosition, currentPosition + 7)}
    currentPosition = currentPosition + 8
    local sign = (bytes[1] > 127) and -1 or 1
    local exponent = ((bytes[1] % 128) * 2) + math_floor(bytes[2] / 128)
    local mantissa = 0
    for i = 1, 6 do
        mantissa = (mantissa * (2 ^ 8)) + bytes[i + 2]
    end
    mantissa = (mantissa == 0) and 0.0 or (mantissa / (2 ^ 52) + 1.0)
    return sign * math_ldexp(mantissa, exponent - 1023)
end

local function readString()
    local length = readShort()
    local str = decodeString(input, currentPosition, currentPosition + length - 1)
    currentPosition = currentPosition + length
    return str
end

local function readBoolean()
    return readByte() ~= 0
end

local function readTable()
    local size = readInt()
    local result = {}
    for i = 1, size do
        local key = readValue()
        local value = readValue()
        result[key] = value
    end
    return result
end

local function readValue()
    local valueType = readByte()
    if valueType == 1 then
        return readByte()
    elseif valueType == 2 then
        return readShort()
    elseif valueType == 3 then
        return readInt()
    elseif valueType == 4 then
        return readFloat()
    elseif valueType == 5 then
        return readDouble()
    elseif valueType == 6 then
        return readString()
    elseif valueType == 7 then
        return readBoolean()
    elseif valueType == 8 then
        return readTable()
    else
        return nil
    end
end

local function mainDecoder(input)
    currentPosition = 1
    return readValue()
end

local input = "LOL!043O00030A3O006C6F6164737472696E67..."
local result = mainDecoder(input)
print(result)
