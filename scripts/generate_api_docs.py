#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EPA Punjab EnvironmentGPT - API Documentation Generator
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
pdfmetrics.registerFont(TTFont('DejaVuSans', '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'))
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')

def create_api_docs():
    """Generate the EnvironmentGPT API Documentation PDF"""

    output_path = '/home/z/my-project/download/EnvironmentGPT_API_Documentation.pdf'

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72,
        title='EnvironmentGPT API Documentation',
        author='Z.ai',
        creator='Z.ai',
        subject='API reference for EnvironmentGPT platform integration'
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

    code_style = ParagraphStyle(
        name='CodeStyle',
        fontName='DejaVuSans',
        fontSize=9,
        leading=12,
        backColor=colors.HexColor('#F5F5F5'),
        leftIndent=10,
        rightIndent=10,
        spaceBefore=6,
        spaceAfter=6
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
    story.append(Paragraph("API Documentation", ParagraphStyle(
        name='Subtitle', fontName='Times New Roman', fontSize=18, alignment=TA_CENTER,
        textColor=colors.HexColor('#2E75B6')
    )))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("RESTful API Reference v1.0", ParagraphStyle(
        name='Version', fontName='Times New Roman', fontSize=12, alignment=TA_CENTER
    )))
    story.append(Paragraph("EPA Punjab | March 2024", ParagraphStyle(
        name='Org', fontName='Times New Roman', fontSize=11, alignment=TA_CENTER,
        textColor=colors.gray
    )))
    story.append(PageBreak())

    # Overview
    story.append(Paragraph("<b>1. API Overview</b>", heading1_style))
    story.append(Paragraph("""
    The EnvironmentGPT API provides programmatic access to the environmental question-answering
    system. This RESTful API enables developers to integrate environmental knowledge capabilities
    into their applications, allowing users to query information about air quality, water resources,
    climate change, waste management, and other environmental topics relevant to Punjab, Pakistan.
    """, body_style))

    story.append(Paragraph("<b>1.1 Base URL</b>", heading2_style))
    story.append(Paragraph("https://environmentgpt.epa.punjab.gov.pk/api", code_style))

    story.append(Paragraph("<b>1.2 Authentication</b>", heading2_style))
    story.append(Paragraph("""
    API requests require authentication using Bearer tokens. Include your API key in the
    Authorization header of each request. API keys can be obtained through the EPA Punjab
    developer portal.
    """, body_style))
    story.append(Paragraph("Authorization: Bearer YOUR_API_KEY", code_style))

    story.append(Paragraph("<b>1.3 Rate Limits</b>", heading2_style))
    story.append(Paragraph("""
    Standard API access is limited to 100 requests per minute. Rate limit headers are included
    in each response to help manage request volumes.
    """, body_style))

    # Endpoints
    story.append(Paragraph("<b>2. API Endpoints</b>", heading1_style))

    # Chat endpoint
    story.append(Paragraph("<b>2.1 POST /chat</b>", heading2_style))
    story.append(Paragraph("""
    Submit a natural language query and receive an AI-generated response with source citations.
    This is the primary endpoint for interacting with the EnvironmentGPT system.
    """, body_style))

    story.append(Paragraph("<b>Request Body</b>", heading2_style))

    chat_params = [
        [Paragraph('<b>Parameter</b>', header_style), Paragraph('<b>Type</b>', header_style),
         Paragraph('<b>Required</b>', header_style), Paragraph('<b>Description</b>', header_style)],
        [Paragraph('query', cell_style), Paragraph('string', cell_style),
         Paragraph('Yes', cell_style), Paragraph('The natural language question to process', cell_style)],
        [Paragraph('sessionId', cell_style), Paragraph('string', cell_style),
         Paragraph('No', cell_style), Paragraph('Session ID for conversation continuity', cell_style)],
        [Paragraph('audienceType', cell_style), Paragraph('string', cell_style),
         Paragraph('No', cell_style), Paragraph('"General Public", "Technical", or "Policy Maker"', cell_style)],
        [Paragraph('includeSources', cell_style), Paragraph('boolean', cell_style),
         Paragraph('No', cell_style), Paragraph('Include source citations (default: true)', cell_style)],
    ]

    chat_table = Table(chat_params, colWidths=[1.2*inch, 0.8*inch, 0.8*inch, 2.7*inch])
    chat_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))

    story.append(chat_table)
    story.append(Spacer(1, 0.15*inch))

    story.append(Paragraph("<b>Response Schema</b>", heading2_style))

    response_fields = [
        [Paragraph('<b>Field</b>', header_style), Paragraph('<b>Type</b>', header_style),
         Paragraph('<b>Description</b>', header_style)],
        [Paragraph('success', cell_style), Paragraph('boolean', cell_style),
         Paragraph('Indicates if the request was successful', cell_style)],
        [Paragraph('response', cell_style), Paragraph('string', cell_style),
         Paragraph('The generated answer text', cell_style)],
        [Paragraph('sources', cell_style), Paragraph('array', cell_style),
         Paragraph('List of source references with relevance scores', cell_style)],
        [Paragraph('confidence', cell_style), Paragraph('number', cell_style),
         Paragraph('Confidence score between 0 and 1', cell_style)],
        [Paragraph('sessionId', cell_style), Paragraph('string', cell_style),
         Paragraph('Session ID for follow-up queries', cell_style)],
        [Paragraph('processingTime', cell_style), Paragraph('number', cell_style),
         Paragraph('Time in milliseconds to process the query', cell_style)],
    ]

    response_table = Table(response_fields, colWidths=[1.2*inch, 0.8*inch, 3.5*inch])
    response_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))

    story.append(response_table)
    story.append(Spacer(1, 0.15*inch))

    # Documents endpoint
    story.append(Paragraph("<b>2.2 GET /documents</b>", heading2_style))
    story.append(Paragraph("""
    Retrieve a paginated list of documents in the knowledge base. Supports filtering by
    category, audience type, and text search.
    """, body_style))

    story.append(Paragraph("<b>Query Parameters</b>", heading2_style))

    doc_params = [
        [Paragraph('<b>Parameter</b>', header_style), Paragraph('<b>Type</b>', header_style),
         Paragraph('<b>Default</b>', header_style), Paragraph('<b>Description</b>', header_style)],
        [Paragraph('page', cell_style), Paragraph('integer', cell_style),
         Paragraph('1', cell_style), Paragraph('Page number for pagination', cell_style)],
        [Paragraph('pageSize', cell_style), Paragraph('integer', cell_style),
         Paragraph('10', cell_style), Paragraph('Number of items per page (max: 50)', cell_style)],
        [Paragraph('category', cell_style), Paragraph('string', cell_style),
         Paragraph('null', cell_style), Paragraph('Filter by document category', cell_style)],
        [Paragraph('search', cell_style), Paragraph('string', cell_style),
         Paragraph('null', cell_style), Paragraph('Search text in title and content', cell_style)],
    ]

    doc_table = Table(doc_params, colWidths=[1.1*inch, 0.8*inch, 0.8*inch, 2.8*inch])
    doc_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))

    story.append(doc_table)
    story.append(Spacer(1, 0.15*inch))

    # Stats endpoint
    story.append(Paragraph("<b>2.3 GET /stats</b>", heading2_style))
    story.append(Paragraph("""
    Retrieve system statistics including document counts, query volumes, and performance metrics.
    Useful for monitoring and dashboard applications.
    """, body_style))

    # Health endpoint
    story.append(Paragraph("<b>2.4 GET /health</b>", heading2_style))
    story.append(Paragraph("""
    Health check endpoint for monitoring system status. Returns HTTP 200 if all services
    are operational, along with detailed status of dependent services.
    """, body_style))

    # Error handling
    story.append(Paragraph("<b>3. Error Handling</b>", heading1_style))
    story.append(Paragraph("""
    The API uses standard HTTP status codes to indicate request success or failure. Error
    responses include a JSON body with details about the issue encountered.
    """, body_style))

    error_codes = [
        [Paragraph('<b>Code</b>', header_style), Paragraph('<b>Name</b>', header_style),
         Paragraph('<b>Description</b>', header_style)],
        [Paragraph('200', cell_style), Paragraph('OK', cell_style),
         Paragraph('Request successful', cell_style)],
        [Paragraph('400', cell_style), Paragraph('Bad Request', cell_style),
         Paragraph('Invalid request parameters', cell_style)],
        [Paragraph('401', cell_style), Paragraph('Unauthorized', cell_style),
         Paragraph('Missing or invalid API key', cell_style)],
        [Paragraph('429', cell_style), Paragraph('Too Many Requests', cell_style),
         Paragraph('Rate limit exceeded', cell_style)],
        [Paragraph('500', cell_style), Paragraph('Internal Error', cell_style),
         Paragraph('Server-side error occurred', cell_style)],
    ]

    error_table = Table(error_codes, colWidths=[0.8*inch, 1.3*inch, 3.4*inch])
    error_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))

    story.append(error_table)
    story.append(Spacer(1, 0.15*inch))

    # Categories
    story.append(Paragraph("<b>4. Document Categories</b>", heading1_style))
    story.append(Paragraph("""
    EnvironmentGPT organizes knowledge into the following primary categories, which can be
    used for filtering queries and documents.
    """, body_style))

    categories = [
        "Air Quality - Air pollution, emissions, AQI, smog, PM2.5, PM10",
        "Water Resources - Water quality, rivers, groundwater, NEQS water standards",
        "Climate Change - Climate impacts, adaptation, mitigation, weather patterns",
        "Waste Management - Solid waste, hazardous waste, recycling, disposal",
        "Biodiversity - Flora, fauna, ecosystems, conservation",
        "Policy & Regulation - Environmental laws, regulations, compliance, permits",
    ]

    for cat in categories:
        story.append(Paragraph(f"• {cat}", body_style))

    # Build document
    doc.build(story)
    print(f"API Documentation generated: {output_path}")
    return output_path

if __name__ == '__main__':
    create_api_docs()
