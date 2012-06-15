(function() {
  var ASNReader, run, testkey, testkey2, testpass,
    _this = this;

  yepnope({
    load: ['crypto/md5.js', 'crypto/dessrc.js', 'crypto/ascii_conv.js', 'crypto/base64.js', 'custom-web/cross-utils.js', 'crypto/jsbn.js', 'crypto/jsbn2.js', 'common-web/underscore-min.js', 'common-web/underscore.strings.js'],
    complete: function() {
      return run();
    }
  });

  testkey = '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: DES-EDE3-CBC,5594FB8F05A2F457\n\nKzUANaCR7EPURHIbBS9zAUg8CzlZR1IiDYG2PDOxHgMW7vc/UbeNKjX5k+m9V3sZ\noh0SREFmVUvLWC+/l8+FLRCStCr9DS1T4ASjI5qF3ul9f35h6or4Tmi9oxEDnSRM\n7Quy6T8LcW+MvGtqHmoDz7rFmHtArYhes+jC8QfQ941eXbbvqSltGYAtu/LX0p8I\nxAva6th4I4SVyOaBgRhxAC9CIVoK6pexBIHeQj7GNtRHJRJmsK0AX3f85UQUannk\nMNKL4hfRqlwVyHILwDi3nyVwLL6MAWB4JL+w250M9K9x+4Q0Q6y2aA+jR17RYH/j\nUO9U9caom/K4SZ9ef/GoQBKnDgOOUPz9SwvaiBQ31HEMu+T/1Ip0t+QJ8GSZuJOs\niN3Nep0+djbV5gt7baP+lZLODKnlEWJVfi1Ml/TrdOnU2XI+LXyU6+19Xux4Si47\nsL/ngLno4W083reBOWn0bIkvXKfxV3RW4cBtXeweMCspzpUWFz3zwGXPEYQS582n\nQAv5bUh5x64RoOIldoKDan71+2f9PvSIIS5Xqa5OdCW5J9LMBvJu8TCU+BcDQJH8\nv6n6S+pJH0ncqerRpFT4Uf4WTmba2kAlkclFQeIFguBdWMqyvKu94FnIqtOZTl0x\npLCpUDsIUXCcwZ6yWsDxJS9M3eWsoFu8WszWyMBdQ76a5J6Odh+h2MPi9VqxXDQ6\nm3IaOAAAZQs5yUdqmIRyZQuPm6YkkrUomQKbIxrEiekW1ldliPTR+8Bq/E9aZ20k\nqcpFX/PMIJH8TOMTxZsBRQJu1xrlqvoca3P4VNUY3V8=\n-----END RSA PRIVATE KEY-----';

  testkey2 = '-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\nDEK-Info: DES-EDE3-CBC,4A15D2FC4D94BB2A\n\nlqAtvEHNA+gN/S4OPJI4sJfvJE1VaV4jQN4pgbDKFGXwze7uNwMkZ9juRFcaoqN+\ndGn/6RTVAGSj7DlVB5V6rQcwMw+qnxi9/in1jeeaFFESvDPC7StSKXbJW8FI5+kF\nrL7Cz4qctwQ/Lr5qjfoTzdfV0Ej3CpcekQyd0pwqNKK8DgnCKAZf6p/5zx6SZG47\nmkOh3Hbf06upnQk80h59DTD4gtlein3Uxjpwk+X8za8=\n-----END RSA PRIVATE KEY-----';

  testpass = 'testpass';

  ASNReader = (function() {

    ASNReader.prototype.beginHeader = '-----BEGIN RSA PRIVATE KEY-----';

    ASNReader.prototype.endHeader = '-----END RSA PRIVATE KEY-----';

    function ASNReader(text) {
      if (text == null) text = '';
      this.lines = text.split('\n');
    }

    ASNReader.prototype.read = function(password) {
      var asn, cipher, decoded, dekInfo, deskey, index, pkeydecoded, pkeytext, salt, size, xxx;
      log('Starting reading', this.lines.length);
      if (this.lines[0] !== this.beginHeader) return 'Error header';
      if (!_.startsWith(this.lines[2], 'DEK-Info')) {
        return 'Invalid encyption info header';
      }
      dekInfo = this.lines[2].split(':')[1].split(',');
      cipher = _.trim(dekInfo[0]);
      salt = _.trim(dekInfo[1]);
      log('Salt', cipher, salt);
      if (!cipher) return 'Not supported encryption';
      pkeytext = '';
      index = 4;
      while (index < this.lines.length && this.lines[index] !== this.endHeader) {
        pkeytext += _.trim(this.lines[index]);
        index++;
      }
      pkeydecoded = decode64(pkeytext);
      log('Decoded', pkeydecoded, pkeytext);
      decoded = null;
      if ('DES-EDE3-CBC' === cipher) {
        deskey = this.prepare3DESKey(password, chars_from_hex(salt));
        decoded = des(deskey, pkeydecoded, false, 1, chars_from_hex(salt), 0);
        log('DES decoded', decoded, decoded.length);
        log(hex_from_chars(decoded, ' '));
      }
      if (!decoded) return 'Private key is not decoded';
      if (decoded.charCodeAt(0) !== 0x30) return 'ASN format is not recognized';
      size = decoded.charCodeAt(1);
      log('Size', size);
      asn = this.readASN(decoded, 0);
      xxx = new BigInteger();
      xxx.fromString(hex_from_chars(asn.value[2], ''), 16);
      log('ASN', asn, 'xxx', xxx.toString());
      return null;
    };

    ASNReader.prototype.prepare3DESKey = function(password, salt) {
      var data00, deskey, j, keymaterial, md5, result;
      log('prepare3DESKey', password, salt, password.length, salt.length);
      data00 = password + salt;
      result = data00;
      keymaterial = '';
      for (j = 0; j < 2; j++) {
        md5 = str_md5(result);
        keymaterial += md5;
        result = md5 + data00;
      }
      deskey = keymaterial.substr(0, 24);
      return deskey;
    };

    ASNReader.prototype.readASN = function(buffer, from) {
      var begin, end, i, l, length, result, size, str, type, val, value;
      begin = from;
      type = buffer.charCodeAt(from);
      length = 0;
      from++;
      size = buffer.charCodeAt(from);
      from++;
      if (size & 0x80) {
        l = size & 0x7f;
        size = 0;
        for (i = 0; 0 <= l ? i < l : i > l; 0 <= l ? i++ : i--) {
          size = (size << 8) + buffer.charCodeAt(from);
          from++;
        }
      }
      end = begin + size;
      result = {
        type: type
      };
      if (type === 0x30) {
        value = [];
        while (from < end) {
          val = this.readASN(buffer, from);
          from = val.end;
          value.push(val.value);
        }
        result.value = value;
      } else {
        str = '';
        for (i = 0; 0 <= size ? i < size : i > size; 0 <= size ? i++ : i--) {
          str += buffer.charAt(from);
          from++;
        }
        result.value = str;
      }
      result.end = from;
      return result;
    };

    return ASNReader;

  })();

  run = function() {
    var err, pkey;
    pkey = new ASNReader(testkey2);
    err = pkey.read(testpass);
    if (err) return log('Error:', err);
  };

}).call(this);
