yepnope {
	load: ['crypto/md5.js', 'crypto/dessrc.js', 'crypto/ascii_conv.js', 'crypto/base64.js', 'custom-web/cross-utils.js', 'crypto/jsbn.js', 'crypto/jsbn2.js', 'common-web/underscore-min.js', 'common-web/underscore.strings.js']
	complete: () =>
		run()
}

testkey = '''-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: DES-EDE3-CBC,5594FB8F05A2F457

KzUANaCR7EPURHIbBS9zAUg8CzlZR1IiDYG2PDOxHgMW7vc/UbeNKjX5k+m9V3sZ
oh0SREFmVUvLWC+/l8+FLRCStCr9DS1T4ASjI5qF3ul9f35h6or4Tmi9oxEDnSRM
7Quy6T8LcW+MvGtqHmoDz7rFmHtArYhes+jC8QfQ941eXbbvqSltGYAtu/LX0p8I
xAva6th4I4SVyOaBgRhxAC9CIVoK6pexBIHeQj7GNtRHJRJmsK0AX3f85UQUannk
MNKL4hfRqlwVyHILwDi3nyVwLL6MAWB4JL+w250M9K9x+4Q0Q6y2aA+jR17RYH/j
UO9U9caom/K4SZ9ef/GoQBKnDgOOUPz9SwvaiBQ31HEMu+T/1Ip0t+QJ8GSZuJOs
iN3Nep0+djbV5gt7baP+lZLODKnlEWJVfi1Ml/TrdOnU2XI+LXyU6+19Xux4Si47
sL/ngLno4W083reBOWn0bIkvXKfxV3RW4cBtXeweMCspzpUWFz3zwGXPEYQS582n
QAv5bUh5x64RoOIldoKDan71+2f9PvSIIS5Xqa5OdCW5J9LMBvJu8TCU+BcDQJH8
v6n6S+pJH0ncqerRpFT4Uf4WTmba2kAlkclFQeIFguBdWMqyvKu94FnIqtOZTl0x
pLCpUDsIUXCcwZ6yWsDxJS9M3eWsoFu8WszWyMBdQ76a5J6Odh+h2MPi9VqxXDQ6
m3IaOAAAZQs5yUdqmIRyZQuPm6YkkrUomQKbIxrEiekW1ldliPTR+8Bq/E9aZ20k
qcpFX/PMIJH8TOMTxZsBRQJu1xrlqvoca3P4VNUY3V8=
-----END RSA PRIVATE KEY-----
'''

testkey2 = '''-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: DES-EDE3-CBC,4A15D2FC4D94BB2A

lqAtvEHNA+gN/S4OPJI4sJfvJE1VaV4jQN4pgbDKFGXwze7uNwMkZ9juRFcaoqN+
dGn/6RTVAGSj7DlVB5V6rQcwMw+qnxi9/in1jeeaFFESvDPC7StSKXbJW8FI5+kF
rL7Cz4qctwQ/Lr5qjfoTzdfV0Ej3CpcekQyd0pwqNKK8DgnCKAZf6p/5zx6SZG47
mkOh3Hbf06upnQk80h59DTD4gtlein3Uxjpwk+X8za8=
-----END RSA PRIVATE KEY-----
'''

testpass = 'testpass'
class ASNReader
	beginHeader: '-----BEGIN RSA PRIVATE KEY-----'
	endHeader:   '-----END RSA PRIVATE KEY-----'
	constructor: (text = '') ->
		@lines = text.split '\n'

	read: (password) ->
		log 'Starting reading', @lines.length
		if @lines[0] isnt @beginHeader # Invalid header
			return 'Error header'
		if not _.startsWith(@lines[2], 'DEK-Info')
			return 'Invalid encyption info header'
		dekInfo = @lines[2].split(':')[1].split(',')
		cipher = _.trim(dekInfo[0])
		salt = _.trim(dekInfo[1])
		log 'Salt', cipher, salt
		if not cipher
			return 'Not supported encryption'
		pkeytext = ''
		index = 4
		while index<@lines.length and @lines[index] isnt @endHeader
			pkeytext += _.trim @lines[index]
			index++
		pkeydecoded = decode64 pkeytext
		log 'Decoded', pkeydecoded, pkeytext
		# Decrypt
		decoded = null
		if 'DES-EDE3-CBC' is cipher
			deskey = @prepare3DESKey password, chars_from_hex(salt)
			decoded = des(deskey, pkeydecoded, no, 1, chars_from_hex(salt), 0)
			log 'DES decoded', decoded, decoded.length
			log hex_from_chars(decoded, ' ')
		if not decoded
			return 'Private key is not decoded'
		if decoded.charCodeAt(0) isnt 0x30
			return 'ASN format is not recognized'
		size = decoded.charCodeAt(1)
		log 'Size', size
		asn = @readASN decoded, 0
		xxx = new BigInteger()
		xxx.fromString(hex_from_chars(asn.value[2], ''), 16)
		log 'ASN', asn, 'xxx', xxx.toString()
		return null


	prepare3DESKey: (password, salt) ->
		log 'prepare3DESKey', password, salt, password.length, salt.length
		data00 = password+salt
		result = data00
		keymaterial = ''
		for j in [0...2] # miter = 2
			# log 'Iteration', j, result.length
			md5 = str_md5 result
			keymaterial += md5
			result = md5 + data00
		deskey = keymaterial.substr 0, 24
		# log 'DES key', deskey, deskey.length
		return deskey

	readASN: (buffer, from) ->
		begin = from
		type = buffer.charCodeAt from
		length = 0
		from++
		size = buffer.charCodeAt from
		from++
		if size & 0x80 # bigger than 128
			l = size & 0x7f
			size = 0
			for i in [0...l]
				size  = (size << 8) + buffer.charCodeAt(from)
				from++
		end = begin+size
		result = {
			type: type
		}
		if type is 0x30
			# sequence
			value = []
			while from < end
				val = @readASN buffer, from
				from = val.end
				value.push val.value
			result.value = value
		else
			str = ''
			for i in [0...size]
				str += buffer.charAt(from)
				from++
			result.value = str
		result.end = from
		return result

run = () ->
	pkey = new ASNReader(testkey2)
	err = pkey.read(testpass)
	if err
		log 'Error:', err
