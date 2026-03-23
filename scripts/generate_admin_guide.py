#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EPA Punjab EnvironmentGPT - Admin Guide Documentation Generator
Phase 10: Training & Documentation
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily

# Register fonts
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')

def create_admin_guide():
    """Generate the EnvironmentGPT Administrator Guide PDF"""

    output_path = '/home/z/my-project/download/EnvironmentGPT_Administrator_Guide.pdf'

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72,
        title='EnvironmentGPT Administrator Guide',
        author='Z.ai',
        creator='Z.ai',
        subject='Administration and management guide for EnvironmentGPT platform'
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        name='CustomTitle',
        fontName='Times New Roman',
        fontSize=24,
        leading=30,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1F4E79'),
        spaceAfter=20
    )

    heading1_style = ParagraphStyle(
        name='CustomHeading1',
        fontName='Times New Roman',
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#1F4E79'),
        spaceBefore=15,
        spaceAfter=10
    )

    heading2_style = ParagraphStyle(
        name='CustomHeading2',
        fontName='Times New Roman',
        fontSize=13,
        leading=16,
        textColor=colors.HexColor('#2E75B6'),
        spaceBefore=12,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        name='CustomBody',
        fontName='Times New Roman',
        fontSize=10,
        leading=14,
        alignment=TA_JUSTIFY,
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        name='BulletStyle',
        fontName='Times New Roman',
        fontSize=10,
        leading=14,
        leftIndent=20,
        spaceAfter=4
    )

    header_style = ParagraphStyle(name='TableHeader', fontName='Times New Roman', fontSize=9,
                                   textColor=colors.white, alignment=TA_CENTER)
    cell_style = ParagraphStyle(name='TableCell', fontName='Times New Roman', fontSize=9,
                                 alignment=TA_LEFT)

    # Build story
    story = []

    # Cover
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph("EnvironmentGPT", title_style))
    story.append(Paragraph("Administrator Guide", ParagraphStyle(
        name='Subtitle', fontName='Times New Roman', fontSize=18, alignment=TA_CENTER,
        textColor=colors.HexColor('#2E75B6')
    )))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("System Administration & Management", ParagraphStyle(
        name='Desc', fontName='Times New Roman', fontSize=12, alignment=TA_CENTER
    )))
    story.append(Paragraph("EPA Punjab | Version 1.0 | March 2024", ParagraphStyle(
        name='Version', fontName='Times New Roman', fontSize=11, alignment=TA_CENTER,
        textColor=colors.gray
    )))
    story.append(PageBreak())

    # Section 1: System Overview
    story.append(Paragraph("<b>1. System Overview</b>", heading1_style))
    story.append(Paragraph("""
    This administrator guide provides comprehensive instructions for managing, monitoring, and
    maintaining the EnvironmentGPT platform. The system is designed for EPA Punjab staff responsible
    for content management, user support, and system health monitoring.
    """, body_style))

    story.append(Paragraph("<b>1.1 System Architecture</b>", heading2_style))
    story.append(Paragraph("""
    EnvironmentGPT is built on a modern architecture comprising several integrated components.
    The Next.js application serves the frontend and API, while the RAG (Retrieval Augmented
    Generation) engine processes queries and generates responses. The Ollama service provides
    the local LLM capabilities, and the PostgreSQL database stores documents, embeddings, and
    conversation history.
    """, body_style))

    story.append(Paragraph("<b>1.2 Administrator Responsibilities</b>", heading2_style))
    responsibilities = [
        "Managing document uploads and knowledge base content",
        "Monitoring system health and performance metrics",
        "Configuring system settings and parameters",
        "Managing user access and permissions",
        "Reviewing and responding to user feedback",
        "Performing regular system maintenance and backups",
    ]
    for resp in responsibilities:
        story.append(Paragraph(f"• {resp}", bullet_style))

    # Section 2: Admin Dashboard
    story.append(Paragraph("<b>2. Admin Dashboard</b>", heading1_style))
    story.append(Paragraph("<b>2.1 Accessing the Dashboard</b>", heading2_style))
    story.append(Paragraph("""
    The administrator dashboard is accessible at /admin from the main application URL.
    Authentication requires elevated privileges assigned through the user management system.
    Upon successful login, you will see the main dashboard with an overview of system statistics.
    """, body_style))

    story.append(Paragraph("<b>2.2 Dashboard Tabs</b>", heading2_style))

    tabs_data = [
        [Paragraph('<b>Tab</b>', header_style), Paragraph('<b>Function</b>', header_style)],
        [Paragraph('Overview', cell_style), Paragraph('System statistics, quick actions, recent activity', cell_style)],
        [Paragraph('Documents', cell_style), Paragraph('Document management, upload, categorization, processing', cell_style)],
        [Paragraph('Analytics', cell_style), Paragraph('Usage metrics, query analytics, performance graphs', cell_style)],
        [Paragraph('Settings', cell_style), Paragraph('System configuration, cache settings, model parameters', cell_style)],
    ]

    tabs_table = Table(tabs_data, colWidths=[1.5*inch, 4*inch])
    tabs_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))

    story.append(tabs_table)
    story.append(Spacer(1, 0.15*inch))

    # Section 3: Document Management
    story.append(Paragraph("<b>3. Document Management</b>", heading1_style))
    story.append(Paragraph("<b>3.1 Uploading Documents</b>", heading2_style))
    story.append(Paragraph("""
    To add new content to the knowledge base, navigate to the Documents tab and click the
    Upload button. Supported file formats include PDF, DOCX, TXT, and MD. Each document
    requires metadata including title, category, and target audience before processing.
    """, body_style))

    story.append(Paragraph("<b>3.2 Document Processing</b>", heading2_style))
    story.append(Paragraph("""
    After upload, documents undergo automatic processing including text extraction, chunking
    into semantic segments, and embedding generation. Processing status is displayed in the
    document list. Large documents may take several minutes to process fully.
    """, body_style))

    story.append(Paragraph("<b>3.3 Category Assignment</b>", heading2_style))
    story.append(Paragraph("""
    Proper category assignment ensures accurate query routing and response relevance. Each
    document should be assigned to exactly one primary category that best represents its
    content. Categories include Air Quality, Water Resources, Climate Change, Waste Management,
    Biodiversity, and Policy & Regulation.
    """, body_style))

    # Section 4: System Monitoring
    story.append(Paragraph("<b>4. System Monitoring</b>", heading1_style))
    story.append(Paragraph("<b>4.1 Health Indicators</b>", heading2_style))
    story.append(Paragraph("""
    The dashboard displays real-time health indicators for critical system components. Green
    status indicates normal operation, yellow indicates degraded performance, and red indicates
    a critical issue requiring immediate attention. Monitor these indicators regularly to
    ensure system stability.
    """, body_style))

    story.append(Paragraph("<b>4.2 Performance Metrics</b>", heading2_style))

    metrics_data = [
        [Paragraph('<b>Metric</b>', header_style), Paragraph('<b>Description</b>', header_style),
         Paragraph('<b>Target</b>', header_style)],
        [Paragraph('Response Time', cell_style), Paragraph('Average query processing time', cell_style),
         Paragraph('< 3 seconds', cell_style)],
        [Paragraph('Cache Hit Rate', cell_style), Paragraph('Percentage of queries served from cache', cell_style),
         Paragraph('> 50%', cell_style)],
        [Paragraph('System Uptime', cell_style), Paragraph('Percentage of time system is operational', cell_style),
         Paragraph('> 99.5%', cell_style)],
        [Paragraph('Error Rate', cell_style), Paragraph('Percentage of failed requests', cell_style),
         Paragraph('< 1%', cell_style)],
    ]

    metrics_table = Table(metrics_data, colWidths=[1.5*inch, 2.5*inch, 1.5*inch])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))

    story.append(metrics_table)
    story.append(Spacer(1, 0.15*inch))

    # Section 5: Configuration
    story.append(Paragraph("<b>5. System Configuration</b>", heading1_style))
    story.append(Paragraph("<b>5.1 Cache Settings</b>", heading2_style))
    story.append(Paragraph("""
    The response cache improves performance by storing frequently requested query responses.
    Configure cache TTL (Time To Live) based on content update frequency. Higher TTL values
    improve performance but may serve stale content. Recommended TTL is 1 hour for frequently
    changing content and 24 hours for stable reference material.
    """, body_style))

    story.append(Paragraph("<b>5.2 Model Parameters</b>", heading2_style))
    story.append(Paragraph("""
    LLM behavior can be adjusted through several parameters. Temperature controls response
    creativity (lower = more focused, higher = more varied). Top K determines the number
    of document chunks retrieved for context. Max tokens limits response length. Default
    values are optimized for environmental Q&A and should only be modified by experienced
    administrators.
    """, body_style))

    # Section 6: Backup & Recovery
    story.append(Paragraph("<b>6. Backup & Recovery</b>", heading1_style))
    story.append(Paragraph("<b>6.1 Automated Backups</b>", heading2_style))
    story.append(Paragraph("""
    The system performs automated daily backups of the database and configuration files.
    Backups are retained for 7 days by default and stored in the backup volume. Verify
    backup completion daily through the admin dashboard or monitoring alerts.
    """, body_style))

    story.append(Paragraph("<b>6.2 Manual Backup</b>", heading2_style))
    story.append(Paragraph("""
    To create a manual backup before significant changes, use the Backup button in Settings
    or run the backup script from the server command line. Store critical backups offsite
    for disaster recovery purposes.
    """, body_style))

    story.append(Paragraph("<b>6.3 Recovery Procedures</b>", heading2_style))
    story.append(Paragraph("""
    In case of data loss or corruption, restore from the most recent backup using the
    recovery script. Document the incident, including timestamp and suspected cause.
    Test the restored system thoroughly before returning to production.
    """, body_style))

    # Section 7: Security
    story.append(Paragraph("<b>7. Security Management</b>", heading1_style))
    story.append(Paragraph("<b>7.1 Access Control</b>", heading2_style))
    story.append(Paragraph("""
    Administrator access is controlled through role-based permissions. Regular users have
    query-only access, while administrators have full system access. Review user access
    quarterly and remove inactive accounts. Never share administrator credentials.
    """, body_style))

    story.append(Paragraph("<b>7.2 Security Best Practices</b>", heading2_style))
    security_practices = [
        "Use strong, unique passwords for all accounts",
        "Enable two-factor authentication where available",
        "Review access logs weekly for suspicious activity",
        "Keep system software updated with security patches",
        "Never expose administrative interfaces to the public internet",
    ]
    for practice in security_practices:
        story.append(Paragraph(f"• {practice}", bullet_style))

    # Section 8: Troubleshooting
    story.append(Paragraph("<b>8. Troubleshooting</b>", heading1_style))

    issues_data = [
        [Paragraph('<b>Issue</b>', header_style), Paragraph('<b>Possible Cause</b>', header_style),
         Paragraph('<b>Solution</b>', header_style)],
        [Paragraph('Slow responses', cell_style), Paragraph('High load, cache miss', cell_style),
         Paragraph('Check system resources, increase cache TTL', cell_style)],
        [Paragraph('Empty responses', cell_style), Paragraph('No relevant documents', cell_style),
         Paragraph('Upload more relevant documents, check category', cell_style)],
        [Paragraph('Service unavailable', cell_style), Paragraph('Container down, memory issue', cell_style),
         Paragraph('Restart services, check logs', cell_style)],
        [Paragraph('Upload failures', cell_style), Paragraph('File size, format, permissions', cell_style),
         Paragraph('Check file limits, format, disk space', cell_style)],
    ]

    issues_table = Table(issues_data, colWidths=[1.3*inch, 1.8*inch, 2.4*inch])
    issues_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))

    story.append(issues_table)

    # Build document
    doc.build(story)
    print(f"Administrator Guide generated: {output_path}")
    return output_path

if __name__ == '__main__':
    create_admin_guide()
