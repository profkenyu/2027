from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from pathlib import Path
import pypdfium2 as pdfium
from pypdf import PdfReader

ROOT=Path('/Users/kenyu/Desktop/20th_codex/20th')
OUT=ROOT/'output/pdf/전시계획_2026-11-03.pdf'
pdfmetrics.registerFont(TTFont('Korean','/System/Library/Fonts/Supplemental/AppleGothic.ttf'))
INK=colors.HexColor('#202B31'); ACCENT=colors.HexColor('#285A68'); MUTED=colors.HexColor('#58666C')
styles={
 'title':ParagraphStyle('title',fontName='Korean',fontSize=25,leading=33,textColor=INK,spaceAfter=12),
 'lead':ParagraphStyle('lead',fontName='Korean',fontSize=12,leading=20,textColor=ACCENT,spaceAfter=16,wordWrap='CJK'),
 'head':ParagraphStyle('head',fontName='Korean',fontSize=14,leading=21,textColor=INK,spaceBefore=16,spaceAfter=9,keepWithNext=True),
 'body':ParagraphStyle('body',fontName='Korean',fontSize=10.4,leading=17.5,textColor=INK,spaceAfter=9,wordWrap='CJK'),
 'small':ParagraphStyle('small',fontName='Korean',fontSize=8.3,leading=13,textColor=MUTED,spaceAfter=6,wordWrap='CJK'),
 'cell':ParagraphStyle('cell',fontName='Korean',fontSize=9,leading=14,textColor=INK,wordWrap='CJK'),
 'th':ParagraphStyle('th',fontName='Korean',fontSize=9,leading=14,textColor=ACCENT,wordWrap='CJK'),
}
story=[]
def p(t,style='body'): story.append(Paragraph(t,styles[style]))
def h(t): p(t,'head')
def table(rows,widths):
 data=[[Paragraph(str(v),styles['th' if i==0 else 'cell']) for v in r] for i,r in enumerate(rows)]
 t=Table(data,colWidths=widths,hAlign='LEFT',repeatRows=1)
 t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#EEF3F4')),('LINEBELOW',(0,0),(-1,0),0.7,ACCENT),('LINEBELOW',(0,1),(-1,-1),0.35,colors.HexColor('#D7DFE1')),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),8)]))
 story.append(t); story.append(Spacer(1,7))

p('BEYOND THE KNOWN · 전시 구성 제안','small')
p('전시계획','title')
p('소개 · 기록 · 몰입 · 개입 · 지속','lead')
p('제시한 장비 구성을 유지하면서 각 화면의 내용과 시간 역할을 나눈다. 입구는 소개, 벽면은 기록, 프로젝터는 몰입, iMac은 개입, 웹은 전시장 밖에서 관람을 이어가는 역할을 담당한다.')
table([
 ['위치 / 장비','권장 콘텐츠','관람 역할'],
 ['입구\nLG 32인치 + Mac mini M2','실제 작품을 녹화·편집한 90~150초 무음 반복영상','전시의 시각 언어 소개'],
 ['벽면\nA3 프레임 20장','본편 장면, 독립 작품, 설계·기록의 이미지와 QR','작품 비교와 선택'],
 ['전시장 안쪽\n엡손 초단초점 + MacBook Air M2','하나의 서사를 이어가는 실시간 자동항해','시간과 공간에 머무는 경험'],
 ['투사면 옆쪽\niMac 27인치','독립 작품 7개 선택·조작','관람객 입력으로 시스템 변화'],
 ['온라인\n공개 웹서버','전체 작품과 안내·관람영상','전시장 밖에서 탐사 계속'],
 ],[145,235,115])
h('1. 입구 · 짧고 명료한 하이라이트')
p('Mac mini에 영상을 저장해 인터넷 없이 반복 재생한다. 작품별 특징이 드러나는 장면을 사용하되, 중요한 사건의 전 과정을 모두 보여주지는 않는다. 전시명과 작가명 외의 설명은 최소화하고 입구는 무음으로 유지한다.')
p('영상에는 ‘작품 실행 화면 편집영상’이라고 작게 표기해 실시간 작품과 구분한다.')
h('공간 · 화면 사이의 관계')
p('입구 모니터의 빛이 투사면에 닿지 않도록 방향을 틀고, 프레임 조명은 인쇄면에만 집중한다. iMac은 투사 관람 동선에서 조금 벗어난 측면에 앉아서 사용할 수 있게 배치한다. 공간 음향은 프로젝터 한 곳에 집중하고, iMac은 헤드폰 사용을 권한다.')
p('공간 치수와 프로젝터의 정확한 모델이 확인되기 전까지, 화면 크기·설치 거리·프레임 배치는 실측 전 제안으로 본다.','small')
story.append(PageBreak())

p('전시계획 · 벽면과 대형 투사','small')
h('2. 벽면 · HTML 20개를 네 묶음으로')
p('현재 폴더는 본편 11장면, 독립 작품 7개, 설계·기록 2개로 구성된다. 모두 출력하되 각각의 성격이 보이도록 구분한다. 본편은 하나의 연속된 탐사·이주 서사이며, 20개 전체를 동일한 성격의 독립 작품으로 소개하지 않는다.')
table([
 ['묶음','수량','배열'],
 ['본편','11장','시작 → 행성 1 → 전이 1 → 행성 2 → 전이 2 → 행성 3 → 전이 3 → 행성 4 → 이주 → 도착 → 엔딩'],
 ['관측의 조건','3장','FOLD → FRAME DRAG → OCCLUSION'],
 ['항해의 조건','4장','ECHO → TRANSFER → DELAY → ABYSS'],
 ['설계·기록','2장','PREVIEW, FIELD ARCHIVE'],
 ],[95,45,355])
p('인쇄물은 A3 가로형을 기본으로 한다. 웹 화면의 원래 비율과 여백을 보존하고, 하단에 제목·짧은 관람 안내·QR을 배치한다. 색과 암부를 임의로 통일하지 않고 각 작품의 화면을 유지한다. 최종 출력 전에는 실제 크기로 교정해 어두운 구조가 소실되지 않는지 확인한다.')
p('프레임 외경 45cm, 간격 15cm를 가정하면 20장에 약 12m가 필요하다. 묶음 사이 여백까지 포함해 총 13~14m의 유효 벽면을 우선 확보한다. 실제 벽면에 나누어 배치하고 중심 높이는 약 145cm부터 검토한다.')
p('QR은 약 40mm 크기의 흑백으로 제작하고 주변에 충분한 흰 여백을 둔다. QR 규격상 사방에 최소 4모듈의 여백이 필요하다. [1]')
h('3. 프로젝터 · 긴 호흡의 본편')
p('입구의 짧은 편집영상과 달리, 투사는 탐사·이주·도착의 인과관계를 이어간다. 전체 15~20분을 편성 목표로 삼되, 실제 모형의 진행 시간과 사건 발생 조건을 확인해 확정한다. 설치와 안정화가 끝나기 전에 다음 사건을 강제로 발생시키지 않는다.')
p('현재 파일은 시작 입력과 마지막 장면 이후 처리가 필요하므로, 처음부터 끝까지 반복하는 전시용 자동운행 모드는 추가 제작 항목이다. 시작·진행·종료·반복·정지 복구를 함께 준비해야 한다.')
p('투사 크기와 설치 거리는 엡손의 정확한 모델과 벽면 실측 후 결정한다. 가장 큰 화면보다 암부와 구조가 읽히는 화면을 기준으로 잡는다. MacBook Air는 MID 품질부터 장시간 검증하고, HDMI 입력을 사용할 경우 USB-C–HDMI 연결을 준비한다. [2]')
story.append(PageBreak())

p('전시계획 · 체험과 온라인 운영','small')
h('4. iMac · 독립 작품 7개의 체험대')
p('첫 화면에서 작품을 고르고 한 작품에 2~4분 정도 개입하도록 구성한다. 마우스·키보드만으로 주요 변화를 경험할 수 있는지 작품별로 확인해야 한다.')
p('iMac은 먼저 실기기 검증이 필요하다. macOS 12의 Chrome 지원은 150에서 종료되었고, 본편 일부는 WebGPU를 필수로 요구한다. 따라서 독립 작품 7개를 우선 검증하고, 본편 탐사는 실행이 확인된 뒤 추가한다. OS 버전만으로 실행 가능·불가를 단정하지 않는다. [3]')
p('무입력 약 120초 후 선택 화면으로 복귀하도록 조정하되, 화면 복귀와 작품의 누적 기록 삭제는 구분한다. 관람객이 남긴 흔적을 유지하는 작품은 그 성격을 보존한다.')
h('5. QR · 장면에 대응하는 실행 경로')
p('본편 중간 장면은 이전 탐사 기록에 따라 진행이 달라진다. 특히 행성 4는 앞선 세 행성의 기록을 확인하므로, 모든 QR을 HTML에 곧바로 연결하면 관람이 끊길 수 있다.')
p('• 본편 11장: 해당 장면 안내에서 ‘전체 탐사 시작’과 ‘관람영상’을 제공한다.<br/>• 독립 작품 7장: 해당 작품 실행을 기본으로 연결한다.<br/>• 설계·기록 2장: 자료 페이지로 연결한다. FIELD ARCHIVE는 현재 기기의 탐사 기록임을 안내한다.')
p('웹서버에는 HTML과 함께 이미지·글꼴·공통 실행 파일·하위 폴더를 유지해 업로드한다. 공개 HTTPS 주소를 확정하고 실제 휴대전화에서 검사한 뒤 QR을 인쇄한다. 현장 장비는 각 컴퓨터의 로컬 사본으로 재생해 전시장 인터넷과 독립적으로 운영한다.')
h('6. 제작과 운영 · 설치 전 확인 순서')
p('iMac 호환성 확인 → 자동운행·작품 안내 제작 → 웹 공개·QR 검사 → A3 교정 출력 → 설치 → 실제 장비로 6~8시간 연속 운전 순서로 진행한다.')
p('마지막 검사에는 반복 경계, 재부팅 후 복구, 발열, 음향 시작을 포함한다. 브라우저 음향은 자동 시작이 제한될 수 있으므로 개관 때 운영자가 활성화하고 확인하는 절차를 둔다. [4]')
h('검토 기준과 참고 자료')
p('검토 대상: 현재 20th 폴더의 HTML 20개 및 공통 행성 실행 파일. 지정한 iMac·프로젝터의 실기기 검증과 전시용 자동운행 모드 제작은 아직 수행하지 않은 준비 항목이다.','small')
refs=[('1. DENSO WAVE · QR 여백 규격','https://www.qrcode.com/en/howto/code.html'),('2. Apple · MacBook Air M2 연결 사양','https://support.apple.com/en-us/111867'),('3. Google · macOS 12 Chrome 지원 종료 안내','https://support.google.com/chrome/thread/404150391?hl=en'),('4. Chrome for Developers · 음향 자동재생 정책','https://developer.chrome.com/blog/autoplay')]
for label,url in refs: p(f'<link href="{url}" color="#285A68">{label}</link>','small')

def footer(c,doc):
 c.setStrokeColor(colors.HexColor('#D7DFE1')); c.line(50,43,A4[0]-50,43)
 c.setFont('Korean',8); c.setFillColor(MUTED)
 c.drawString(50,29,'BEYOND THE KNOWN · 전시계획 · 2026.11.03')
 c.drawRightString(A4[0]-50,29,f'{doc.page}')
doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=50,leftMargin=50,topMargin=43,bottomMargin=56,title='전시계획 | BEYOND THE KNOWN',author='KIM GUNWOO',pageCompression=1)
doc.build(story,onFirstPage=footer,onLaterPages=footer)
r=PdfReader(OUT)
print('pages',len(r.pages),'bytes',OUT.stat().st_size)
for i,page in enumerate(r.pages):
 text=page.extract_text()
 print(i+1,len(text),text[:35].replace('\n',' '))
pdf=pdfium.PdfDocument(str(OUT))
for i in range(len(pdf)):
 pdf[i].render(scale=1.2).to_pil().save(ROOT/f'tmp/pdfs/plan-{i+1}.png')
print(OUT)
