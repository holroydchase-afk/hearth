#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Chase Holroyd
# HRT-WEB.3 (WEB-APP-26, 28, 29): small test JPEGs that carry everything the web pipeline must strip, with a MADE-UP
# place (no real photo, no real location). Run: python3 scripts/make-web-photo-fixtures.py
#   e2e-web/fixtures/web3-gps.jpg      600x400, upright, GPS + MakerNote + camera serial + XMP
#   e2e-web/fixtures/web3-rotated.jpg  600x400 raw pixels, EXIF orientation 6 (shows as 400x600), same markers
# The marker strings below are what the e2e specs search for in the bytes Hearth sends.
import io
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'e2e-web', 'fixtures')
MARKERS = ['HRTMAKERNOTE-9F3A', 'HRTSERIAL-0042', 'HRTMADEUPPLACE-77', 'http://ns.adobe.com/xap/1.0/']
LAT, LON = (12, 20, 44.16), (98, 45, 55.44)  # 12.3456 N, 98.7655 W: made up


def base():
    im = Image.new('RGB', (600, 400))
    d = ImageDraw.Draw(im)
    for x in range(600):
        d.line([(x, 0), (x, 400)], fill=(40 + x // 4, 120, 200 - x // 5))
    d.rectangle([40, 40, 200, 120], fill=(250, 220, 90))  # a corner mark so a rotation is visible
    return im


def tagged(orientation):
    im = base()
    exif = im.getexif()
    exif[0x010F] = 'HrtMakeCo'          # Make
    exif[0x0110] = 'HrtModel'           # Model
    exif[0x0112] = orientation
    exif[0x0132] = '2026:07:04 08:00:00'
    sub = exif.get_ifd(0x8769)
    sub[0x927C] = b'HRTMAKERNOTE-9F3A' + bytes(range(40))   # MakerNote
    sub[0xA431] = 'HRTSERIAL-0042'                          # BodySerialNumber
    gps = exif.get_ifd(0x8825)
    gps[1], gps[2] = 'N', tuple(float(v) for v in LAT)
    gps[3], gps[4] = 'W', tuple(float(v) for v in LON)
    gps[27] = b'ASCII\0\0\0' + b'HRTMADEUPPLACE-77'          # GPSProcessingMethod
    xmp = (b'<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/">'
           b'<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:hrt="urn:hrt:" '
           b'hrt:place="HRTMADEUPPLACE-77"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>')
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=70, exif=exif, xmp=xmp)
    return buf.getvalue()


for name, o in (('web3-gps.jpg', 1), ('web3-rotated.jpg', 6)):
    b = tagged(o)
    for m in MARKERS:
        assert m.encode() in b, (name, m)
    assert b'Exif\0\0' in b
    open(os.path.join(OUT, name), 'wb').write(b)
    print(name, len(b), 'bytes')
