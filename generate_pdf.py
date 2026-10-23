import os
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

def build_pdf(filename="Dhruva_Jaal_Executive_Summary.pdf"):
    # Target: Exactly 1 Page (A4)
    # A4: 595.28 x 841.89 pt
    margin = 18
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=margin,
        rightMargin=margin,
        topMargin=16,
        bottomMargin=14
    )
    
    usable_width = 595.28 - (2 * margin) # 559.28 pt
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=14.5,
        leading=16.5,
        textColor=colors.HexColor('#0369a1')
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.8,
        leading=9.5,
        textColor=colors.HexColor('#334155')
    )
    
    tag_style = ParagraphStyle(
        'MetaTag',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=6.8,
        leading=8.5,
        alignment=2, # right
        textColor=colors.HexColor('#475569')
    )
    
    callout_style = ParagraphStyle(
        'CalloutText',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.1,
        leading=8.8,
        textColor=colors.HexColor('#78350f')
    )
    
    section_title = ParagraphStyle(
        'SecTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.2,
        leading=10,
        textColor=colors.HexColor('#0f172a')
    )
    
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=6.8,
        leading=8.4,
        textColor=colors.HexColor('#1e293b')
    )
    
    bullet_style = ParagraphStyle(
        'Bullet',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=6.6,
        leading=8.0,
        textColor=colors.HexColor('#1e293b')
    )
    
    table_header = ParagraphStyle(
        'TH',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=6.8,
        leading=8.2,
        textColor=colors.HexColor('#0f172a')
    )
    
    table_cell = ParagraphStyle(
        'TD',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=6.4,
        leading=7.8,
        textColor=colors.HexColor('#334155')
    )
    
    table_cell_bold = ParagraphStyle(
        'TDBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=6.4,
        leading=7.8,
        textColor=colors.HexColor('#0f172a')
    )
    
    story = []
    
    # ── 1. HEADER TABLE (Title + Metadata) ──────────────────────────────────
    header_left = [
        Paragraph("<b>DHRUVA JAAL (<font color='#d97706'>ध्रुव जाल</font>)</b>", title_style),
        Paragraph("Autonomous Zero-Infrastructure Emergency LoRa Mesh, Survivor Client & 3D Tactical Digital Twin", subtitle_style)
    ]
    header_right = [
        Paragraph("<b>Octo GDG Hackathon · Disaster Management Track</b>", tag_style),
        Paragraph("GitHub: <b>CodeCrafterAdi2006/dhruva_jaal</b> · License: MIT", tag_style),
        Paragraph("ESP32-C3 · 433MHz LoRa · MapLibre WebGL (60FPS) · PWA Web Serial", tag_style)
    ]
    
    header_table = Table(
        [[header_left, header_right]],
        colWidths=[360, usable_width - 360]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 3))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284c7'), spaceAfter=4, spaceBefore=0))
    
    # ── 2. REAL-WORLD GROUND TRUTH CALLOUT BOX ───────────────────────────────
    ground_truth_html = (
        "<b>REAL-WORLD DISASTER GROUND TRUTH (Kathmandu Valley Basin Floods, Sept 27–29, 2024):</b> "
        "A 50-year record 322mm rainfall in 24h triggered catastrophic Bagmati/Bishnumati river inundation. "
        "Municipal power grid failed; macro cell towers died within 4–6 hours from battery exhaustion, and fiber backhauls were severed. "
        "Over 1,000 citizens were stranded on Balkhu/Teku rooftops in pitch darkness with charged smartphones but <b>0 cellular bars</b>. "
        "Emergency SMS broadcasts failed to deliver; rescuers in rafts navigated blind in fast currents, resulting in 236 fatalities. "
        "<i>Dhruva Jaal asks: What if an off-grid civilian mesh was already there?</i>"
    )
    ground_truth_table = Table(
        [[Paragraph(ground_truth_html, callout_style)]],
        colWidths=[usable_width]
    )
    ground_truth_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#fffbeb')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#f59e0b')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(ground_truth_table)
    story.append(Spacer(1, 4))
    
    # ── 3. SIX-STAGE FLOW BANNER ─────────────────────────────────────────────
    flow_cols = [
        Paragraph("<b>1. Survivor Phone</b><br/><font color='#64748b'>USB-C $8 Dongle</font>", ParagraphStyle('F1', parent=body_style, alignment=1, fontSize=6.2, leading=7.5)),
        Paragraph("<b>➔</b>", ParagraphStyle('FA', parent=body_style, alignment=1, fontSize=7, textColor=colors.HexColor('#0284c7'))),
        Paragraph("<b>2. Rooftop Relays</b><br/><font color='#64748b'>433MHz LoRa Hops</font>", ParagraphStyle('F2', parent=body_style, alignment=1, fontSize=6.2, leading=7.5)),
        Paragraph("<b>➔</b>", ParagraphStyle('FA', parent=body_style, alignment=1, fontSize=7, textColor=colors.HexColor('#0284c7'))),
        Paragraph("<b>3. Drowned Relay</b><br/><font color='#64748b'>SPI Flash Store/Fwd</font>", ParagraphStyle('F3', parent=body_style, alignment=1, fontSize=6.2, leading=7.5)),
        Paragraph("<b>➔</b>", ParagraphStyle('FA', parent=body_style, alignment=1, fontSize=7, textColor=colors.HexColor('#0284c7'))),
        Paragraph("<b>4. Agile Drones (≤6)</b><br/><font color='#64748b'>80m Gap Bridge</font>", ParagraphStyle('F4', parent=body_style, alignment=1, fontSize=6.2, leading=7.5)),
        Paragraph("<b>➔</b>", ParagraphStyle('FA', parent=body_style, alignment=1, fontSize=7, textColor=colors.HexColor('#0284c7'))),
        Paragraph("<b>5. 100m Aerostat</b><br/><font color='#64748b'>Make/Break Handover</font>", ParagraphStyle('F5', parent=body_style, alignment=1, fontSize=6.2, leading=7.5)),
        Paragraph("<b>➔</b>", ParagraphStyle('FA', parent=body_style, alignment=1, fontSize=7, textColor=colors.HexColor('#0284c7'))),
        Paragraph("<b>6. 3D Twin HQ</b><br/><font color='#64748b'>2-Way Verified ACK</font>", ParagraphStyle('F6', parent=body_style, alignment=1, fontSize=6.2, leading=7.5)),
    ]
    flow_table = Table(
        [flow_cols],
        colWidths=[76, 12, 76, 12, 80, 12, 82, 12, 82, 12, 83]
    )
    flow_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#0f172a')),
        ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 2),
        ('RIGHTPADDING', (0,0), (-1,-1), 2),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#1e293b')),
    ]))
    story.append(flow_table)
    story.append(Spacer(1, 4))
    
    # ── 4. THREE PILLARS OF ARCHITECTURE ──────────────────────────────────────
    col_w = (usable_width - 10) / 3 # ~183 pt each
    
    p1 = [
        Paragraph("<b>📱 1. Civilian & Dongle Tier</b>", section_title),
        Spacer(1, 1),
        Paragraph("• <b>$8 Dongle BOM:</b> ESP32-C3 ($3.20) + Semtech SX1278 ($3.80) + internal helical antenna.", bullet_style),
        Paragraph("• <b>USB CDC-ACM Link:</b> Plugs into Android USB-C port via OTG; draws ~35mA idle listening current.", bullet_style),
        Paragraph("• <b>Offline PWA (<font color='#0369a1'>survivor_app/</font>):</b> React 18 + Tailwind client running in Chrome via Web Serial / WebUSB API.", bullet_style),
        Paragraph("• <b>Zero-Bar UX:</b> 1-tap SOS, 5s cancel window, medical/trapped flags, and GPS stamping.", bullet_style)
    ]
    
    p2 = [
        Paragraph("<b>📻 2. Mesh & Firmware Tier</b>", section_title),
        Spacer(1, 1),
        Paragraph("• <b>Flash Store/Forward (<font color='#0369a1'>store.cpp</font>):</b> 1.43MB circular flash buffer stores 24,000+ SOS records when nodes drown.", bullet_style),
        Paragraph("• <b>Slotted CAD MAC (<font color='#0369a1'>mac.cpp</font>):</b> 12.3ms Carrier Activity Detection + jittered backoff avoids collisions.", bullet_style),
        Paragraph("• <b>Geographic Forwarding:</b> Scores neighbors by progress to HQ, link RSSI, and aerial bonus.", bullet_style),
        Paragraph("• <b>Two-Way ACK:</b> Survivor phone turns GREEN only on confirmed receipt from Base Camp.", bullet_style)
    ]
    
    p3 = [
        Paragraph("<b>🚁 3. Two-Tier Aerial & 3D Twin</b>", section_title),
        Spacer(1, 1),
        Paragraph("• <b>Strict 6-Drone Limit:</b> Airspace deconfliction & battery constraints cap fleet to 6 active units.", bullet_style),
        Paragraph("• <b>Steiner Gap Optimizer:</b> Algorithmic clustering detects isolated survivors & computes bridge points.", bullet_style),
        Paragraph("• <b>Auto-Balloon Handover:</b> If gaps exceed 6, stationed drones are auto-relieved by 100m aerostats.", bullet_style),
        Paragraph("• <b>Procedural Audio:</b> Pure Web Audio API synthesizes real LoRa CSS chirps (800Hz→2400Hz).", bullet_style)
    ]
    
    pillar_table = Table(
        [[p1, p2, p3]],
        colWidths=[col_w, col_w, col_w]
    )
    pillar_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,0), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (1,0), (1,0), colors.HexColor('#f8fafc')),
        ('BACKGROUND', (2,0), (2,0), colors.HexColor('#f0f9ff')),
        ('BOX', (0,0), (0,0), 1, colors.HexColor('#e2e8f0')),
        ('BOX', (1,0), (1,0), 1, colors.HexColor('#e2e8f0')),
        ('BOX', (2,0), (2,0), 1, colors.HexColor('#7dd3fc')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))
    story.append(pillar_table)
    story.append(Spacer(1, 4))
    
    # ── 5. TABLES: RF PROPAGATION PHYSICS & SCENARIO TIMELINE ────────────────
    t1_data = [
        [Paragraph("<b>RF Physics Parameter</b>", table_header), Paragraph("<b>Design Value</b>", table_header), Paragraph("<b>Operational Significance</b>", table_header)],
        [Paragraph("Carrier Frequency", table_cell_bold), Paragraph("433.00 MHz ISM", table_cell), Paragraph("λ=69.2cm; superior knife-edge diffraction vs 868/915MHz in wet masonry.", table_cell)],
        [Paragraph("Modulation Profile", table_cell_bold), Paragraph("SF10 · BW 125kHz · CR 4/5", table_cell), Paragraph("Receiver sensitivity -137 dBm; link budget +157 dB for urban penetration.", table_cell)],
        [Paragraph("Time-on-Air (ToA)", table_cell_bold), Paragraph("370.7 ms (32-byte frame)", table_cell), Paragraph("Sub-400ms airtime minimizes channel occupancy and collision probability.", table_cell)],
        [Paragraph("1st Fresnel Zone (F₁)", table_cell_bold), Paragraph("F₁ = 8.656√(d_km / 0.433)", table_cell), Paragraph("Ground links blocked by flood/roofs (<20%); 100m aerostat guarantees 96% LoS.", table_cell)],
        [Paragraph("Routing Score Metric", table_cell_bold), Paragraph("0.50·Δd + 0.30·RSSI + 0.20·Alt", table_cell), Paragraph("Steers packets geographically toward Base Camp without global routing tables.", table_cell)],
    ]
    t1_width = (usable_width - 8) * 0.52
    t1 = Table(t1_data, colWidths=[90, 85, t1_width - 175])
    t1.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
        ('BOX', (0,0), (-1,-1), 0.8, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    
    t2_data = [
        [Paragraph("<b>Timeline</b>", table_header), Paragraph("<b>Phase</b>", table_header), Paragraph("<b>Simulated Event & System Response</b>", table_header)],
        [Paragraph("t = 0.0s", table_cell_bold), Paragraph("P1", table_cell), Paragraph("Grid blackout; Survivor N1 (Balkhu) sends SOS1 across ground mesh.", table_cell)],
        [Paragraph("t = 12.6s", table_cell_bold), Paragraph("P1", table_cell), Paragraph("Base Camp receives SOS1; returns 2-way ACK; N1 turns GREEN.", table_cell)],
        [Paragraph("t = 18.0s", table_cell_bold), Paragraph("P2", table_cell), Paragraph("Bagmati floods reach 4.5m; Relay N2 submerged (OFFLINE).", table_cell)],
        [Paragraph("t = 24.0s", table_cell_bold), Paragraph("P2", table_cell), Paragraph("N1 sends SOS2; path severed; cached in SPI flash memory (YELLOW).", table_cell)],
        [Paragraph("t = 30.0s", table_cell_bold), Paragraph("P3", table_cell), Paragraph("Base Camp scrambles Drone DR1 to 80m; bridges gap & pulls SOS2.", table_cell)],
        [Paragraph("t = 46.0s", table_cell_bold), Paragraph("P4", table_cell), Paragraph("Aerostat BL1 ascends to 100m; DR1 freed; Balloon ACK turns N1 GREEN.", table_cell)],
    ]
    t2_width = (usable_width - 8) * 0.48
    t2 = Table(t2_data, colWidths=[38, 26, t2_width - 64])
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
        ('BOX', (0,0), (-1,-1), 0.8, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('LEFTPADDING', (0,0), (-1,-1), 3),
        ('RIGHTPADDING', (0,0), (-1,-1), 3),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    
    mid_table = Table([[t1, t2]], colWidths=[t1_width, t2_width])
    mid_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(mid_table)
    story.append(Spacer(1, 4))
    
    # ── 6. CODEBASE REPOSITORY MAP & LIVE VERIFICATION ────────────────────────
    footer_p1 = Paragraph(
        "<b>Monorepo Structure:</b> "
        "<font color='#0369a1'><b>frontend/</b></font> (3D Command Digital Twin & Audio Synthesizer) · "
        "<font color='#0369a1'><b>survivor_app/</b></font> (React 18 PWA + Web Serial API) · "
        "<font color='#0369a1'><b>firmware/</b></font> (ESP32-C3 Bare-Metal C++ Mesh Driver) · "
        "<font color='#0369a1'><b>docs/</b></font> (Protocols)",
        ParagraphStyle('Foot1', parent=body_style, fontSize=6.5, leading=8.0)
    )
    footer_p2 = Paragraph(
        "<b>Live Verification:</b> Run <code>cd frontend && npm run dev</code> → <b>http://localhost:5173</b> (Space=Play, R=Reset, Mode=Sandbox, Auto=Gap-Bridge). "
        "Run <code>cd survivor_app && npm run dev</code> → <b>http://localhost:5173/?mock</b> (Phone Simulator). <b>60 FPS WebGL Guaranteed.</b>",
        ParagraphStyle('Foot2', parent=body_style, fontSize=6.5, leading=8.0)
    )
    
    footer_table = Table(
        [[footer_p1], [footer_p2]],
        colWidths=[usable_width]
    )
    footer_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 0.8, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 2.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2.5),
        ('LEFTPADDING', (0,0), (-1,-1), 5),
        ('RIGHTPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(footer_table)
    
    doc.build(story)
    print(f"Successfully generated {filename}")

if __name__ == '__main__':
    build_pdf()
