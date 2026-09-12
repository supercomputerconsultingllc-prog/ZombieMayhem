"""Original Zombie Mayhem soundtrack and SFX. Reproducible offline master, no runtime oscillators.
Requires Python/numpy and ffmpeg; does not fetch external or third-party samples.
"""
from pathlib import Path
import numpy as np
import wave, subprocess, tempfile
RATE=24000
rng=np.random.default_rng(1946)
OUT=Path(__file__).resolve().parents[1]/'docs/v2/assets/audio'
OUT.mkdir(parents=True,exist_ok=True)

def save(name,signal):
    signal=np.tanh(signal*.8)
    peak=max(.01,float(np.max(np.abs(signal))))
    signal=(signal/peak*.72*32767).astype('<i2')
    with tempfile.NamedTemporaryFile(suffix='.wav') as temp:
        with wave.open(temp.name,'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(signal.tobytes())
        subprocess.run(['ffmpeg','-y','-loglevel','error','-i',temp.name,'-c:a','libmp3lame','-b:a','96k',str(OUT/(name+'.mp3'))],check=True)

def tone(freq,duration,kind='sine'):
    t=np.arange(int(duration*RATE))/RATE
    phase=2*np.pi*freq*t
    x=np.sin(phase)
    if kind=='bass': x+=.3*np.sin(phase*2)+.16*np.sin(phase*3)
    if kind=='pad': x+=.2*np.sin(phase*1.003)+.18*np.sin(phase*.997)+.08*np.sin(phase*2)
    attack=np.minimum(1,t/.01);release=np.minimum(1,(duration-t)/.035)
    return x*attack*release

def add(track,sample,at,gain=1):
    at=int(at*RATE);n=min(len(sample),len(track)-at)
    if n>0: track[at:at+n]+=sample[:n]*gain

# Eight-bar E-minor cue, 120 BPM. All three stems share a 16-second loop.
length=16;beat=.5
bed=np.zeros(length*RATE);combat=bed.copy();boss=bed.copy()
roots=[82.4069,82.4069,65.4064,65.4064,73.4162,73.4162,61.7354,73.4162]
for bar,root in enumerate(roots):
    start=bar*2
    for ratio in [1,1.189207,1.498307]: add(bed,tone(root*ratio,2,'pad'),start,.095)
    for step,degree in enumerate([0,7,12,3,7,10,7,3]):
        add(bed,tone(root*2*2**(degree/12),.19),start+step*.25,.07 if step%2 else .11)
        bass=tone(root/2,.22,'bass')*np.exp(-np.arange(int(.22*RATE))/RATE*5)
        add(combat,bass,start+step*.25,.45 if step%2==0 else .24)
    for b in range(4):
        t=np.arange(int(.22*RATE))/RATE
        kick=np.sin(2*np.pi*(46*t+9*(1-np.exp(-t*35))))*np.exp(-t*22)
        add(combat,kick,start+b*beat,.78)
        if b%2:
            t=np.arange(int(.15*RATE))/RATE
            noise=rng.normal(size=len(t));snare=(noise*.45+np.sin(2*np.pi*185*t)*.25)*np.exp(-t*26)
            add(combat,snare,start+b*beat,.55)
    for tick in range(16):
        t=np.arange(int(.045*RATE))/RATE;noise=rng.normal(size=len(t));noise=np.r_[0,np.diff(noise)]
        add(combat,noise*np.exp(-t*90),start+tick*.125,.043 if tick%2 else .072)
    for b in [0,1.5]:
        pulse=tone(root/2, .4,'bass')*np.exp(-np.arange(int(.4*RATE))/RATE*5)
        add(boss,pulse,start+b,.5)
    for step in range(8): add(boss,tone(root*2**([12,19,15,22][step%4]/12),.18,'bass'),start+step*.25,.12)
# Circular delays preserve the loop boundary.
bed+=np.roll(bed,int(.375*RATE))*.22
boss+=np.roll(boss,int(.25*RATE))*.13
for name,track in [('bed',bed),('combat',combat),('boss',boss)]:save(name,track)

for name,freq,duration,punch,noiseGain in [
 ('rifle',140,.14,.7,.8),('shotgun',95,.28,.9,1),('sniper',210,.38,1,.65),('minigun',180,.1,.55,.65),
 ('flame',60,.2,.1,.7),('tesla',680,.24,.5,.2),('freeze',980,.28,.3,.08),('grenade',62,.42,1,.9),
 ('hit',170,.075,.2,.55),('crit',800,.12,.25,.15),('kill',83,.15,.3,.5),('hurt',68,.3,.8,.3),('slam',44,.5,1,.8)]:
    t=np.arange(int(duration*RATE))/RATE
    noise=rng.normal(size=len(t));noise=np.convolve(noise,np.ones(5)/5,mode='same')
    phase=2*np.pi*(freq*t+(freq*.3)*(1-np.exp(-t*25))/25)
    body=np.sin(phase)*np.exp(-t*14)*punch
    if name=='tesla':body=np.sin(phase+np.sin(t*120)*5)*np.exp(-t*12)*.6
    if name=='freeze':body=(np.sin(phase)+np.sin(phase*1.5))*.3*np.exp(-t*9)
    sample=(body+noise*np.exp(-t*(25 if duration<.3 else 13))*noiseGain)*np.minimum(1,t/.002)
    sample+=np.roll(sample,int(.035*RATE))*.13
    save(name,sample)
for name,notes in [('loot',[659.25,987.77]),('mission',[329.63,493.88,659.25]),('overdrive',[164.81,329.63,659.25])]:
    track=np.zeros(int(.75*RATE))
    for i,note in enumerate(notes):add(track,tone(note,.27,'pad'),i*.12,.4)
    save(name,track)
print('Rendered',len(list(OUT.glob('*.mp3'))),'original audio assets')
