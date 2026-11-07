"""Build the installable webOS package (.ipk) of F1 for LG webOS: the app and its helper service in one package.

Usage:
    python tools/build.py                      -> dist/<app id>_<version>_all.ipk
    python tools/build.py --icons <folder>     use icon.png, largeIcon.png and logo.png (loading screen) from <folder>
                                               instead of app/'s, for each one the folder has

Needs only Python 3 (standard library). The .ipk is an ar archive of debian-binary, control.tar.gz and data.tar.gz,
the format webOS (and the Homebrew Channel) installs.
"""
import argparse
import hashlib
import io
import json
import os
import tarfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def tar_gz(entries, now):
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode='w:gz', format=tarfile.GNU_FORMAT) as t:
        for name, data, mode in entries:
            ti = tarfile.TarInfo(name)
            ti.mtime, ti.uid, ti.gid, ti.uname, ti.gname = now, 0, 0, 'root', 'root'
            if data is None:
                ti.type, ti.mode = tarfile.DIRTYPE, 0o755
                t.addfile(ti)
            else:
                ti.size, ti.mode = len(data), mode
                t.addfile(ti, io.BytesIO(data))
    return buf.getvalue()


def ar_member(name, payload, now):
    hdr = f"{name + '/':<16}{now:<12}{0:<6}{0:<6}{'100644':<8}{len(payload):<10}`\n".encode()
    assert len(hdr) == 60
    return hdr + payload + (b'\n' if len(payload) % 2 else b'')


def add_dir(entries, src, dest, icons=None):
    entries.append((dest, None, 0))
    for f in sorted(os.listdir(src)):
        p = os.path.join(src, f)
        if os.path.isdir(p) or f.startswith('.'):
            continue
        if icons and f in ('icon.png', 'largeIcon.png', 'logo.png') and os.path.exists(os.path.join(icons, f)):
            p = os.path.join(icons, f)
        with open(p, 'rb') as fh:
            entries.append((dest + '/' + f, fh.read(), 0o755 if f.endswith('.sh') else 0o644))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--icons', help='folder with icon.png and largeIcon.png to use instead of the app folder\'s')
    ap.add_argument('--out', default=os.path.join(ROOT, 'dist'))
    ap.add_argument('--repo', help='GitHub owner/name, e.g. someone/F1-for-LG-webOS: also write apps.json and the '
                                   'manifest for the Homebrew Channel')
    a = ap.parse_args()

    app = json.load(open(os.path.join(ROOT, 'app', 'appinfo.json'), encoding='utf-8'))
    svc = json.load(open(os.path.join(ROOT, 'service', 'package.json'), encoding='utf-8'))
    app_id, version, svc_id = app['id'], app['version'], svc['name']
    assert svc_id == app_id + '.service', f'service name {svc_id} must be {app_id}.service'
    services_json = json.load(open(os.path.join(ROOT, 'service', 'services.json'), encoding='utf-8'))
    assert services_json['id'] == svc_id, 'service/services.json id must match service/package.json name'
    if svc.get('version') != version:
        print(f'note: service version {svc.get("version")} differs from app version {version}')

    now = int(time.time())
    entries = [('./', None, 0), ('./usr', None, 0), ('./usr/palm', None, 0),
               ('./usr/palm/applications', None, 0), ('./usr/palm/services', None, 0), ('./usr/palm/packages', None, 0)]
    add_dir(entries, os.path.join(ROOT, 'app'), f'./usr/palm/applications/{app_id}', a.icons)
    add_dir(entries, os.path.join(ROOT, 'service'), f'./usr/palm/services/{svc_id}')
    packageinfo = {'app': app_id, 'id': app_id, 'loc_name': app['title'], 'package_format_version': 2,
                   'services': [svc_id], 'vendor': app.get('vendor', ''), 'version': version}
    entries.append((f'./usr/palm/packages/{app_id}', None, 0))
    entries.append((f'./usr/palm/packages/{app_id}/packageinfo.json', json.dumps(packageinfo, indent=2).encode(), 0o644))
    data = tar_gz(entries, now)

    control = (f"Package: {app_id}\nVersion: {version}\nSection: misc\nPriority: optional\nArchitecture: all\n"
               f"Installed-Size: {len(data) // 1024 + 1}\nMaintainer: {app.get('vendor', '')}\n"
               f"Description: {app['title']}\nwebOS-Package-Format-Version: 2\nwebOS-Packager-Version: x.y.x\n").encode()
    ctrl = tar_gz([('./', None, 0), ('./control', control, 0o644)], now)

    os.makedirs(a.out, exist_ok=True)
    out = os.path.join(a.out, f'{app_id}_{version}_all.ipk')
    with open(out, 'wb') as fh:
        fh.write(b'!<arch>\n')
        fh.write(ar_member('debian-binary', b'2.0\n', now))
        fh.write(ar_member('control.tar.gz', ctrl, now))
        fh.write(ar_member('data.tar.gz', data, now))
    print(f'built {out} ({os.path.getsize(out)} bytes): {app_id} {version} with service {svc_id}')

    if a.repo:
        write_homebrew_repo(a.repo, a.out, out, app, version)


DESCRIPTION = 'F1 TV on LG TVs: full-screen player you can use with the remote\'s arrow keys'


def write_homebrew_repo(repo, out_dir, ipk, app, version):
    """Write apps.json and <id>.manifest.json for the Homebrew Channel. Upload both with the .ipk to the GitHub release
    tagged v<version>; the Homebrew Channel then installs and updates the app from
    https://github.com/<repo>/releases/latest/download/apps.json"""
    app_id = app['id']
    base = f'https://github.com/{repo}'
    dl = f'{base}/releases/download/v{version}'
    with open(ipk, 'rb') as fh:
        blob = fh.read()
    manifest = {
        'id': app_id,
        'version': version,
        'type': 'web',
        'title': app['title'],
        'appDescription': DESCRIPTION,
        'iconUri': f'https://raw.githubusercontent.com/{repo}/main/app/largeIcon.png',
        'sourceUrl': base,
        'rootRequired': False,
        'ipkUrl': f'{dl}/{os.path.basename(ipk)}',
        'ipkHash': {'sha256': hashlib.sha256(blob).hexdigest()},
        'ipkSize': len(blob),
    }
    manifest_name = f'{app_id}.manifest.json'
    with open(os.path.join(out_dir, manifest_name), 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, indent=2)
    apps = {
        'paging': {'page': 1, 'count': 1, 'maxPage': 1, 'itemsTotal': 1},
        'packages': [{
            'id': app_id,
            'title': app['title'],
            'iconUri': manifest['iconUri'],
            'shortDescription': DESCRIPTION,
            'manifestUrl': f'{dl}/{manifest_name}',
            'manifest': manifest,
            'pool': 'main',
        }],
    }
    with open(os.path.join(out_dir, 'apps.json'), 'w', encoding='utf-8') as fh:
        json.dump(apps, fh, indent=2)
    print(f'wrote {manifest_name} and apps.json for {base} (release tag v{version})')


if __name__ == '__main__':
    main()
