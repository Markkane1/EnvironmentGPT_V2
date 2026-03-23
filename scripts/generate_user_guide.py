#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EPA Punjab EnvironmentGPT - User Guide Documentation Generator
Phase 10: Training & Documentation
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, ListFlowable, ListItem, Image
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily
import os

# Register fonts
pdfmetrics.registerFont(TTFont('Times New Roman', '/usr/share/fonts/truetype/english/Times-New-Roman.ttf'))
pdfmetrics.registerFont(TTFont('Calibri', '/usr/share/fonts/truetype/english/calibri-regular.ttf'))
registerFontFamily('Times New Roman', normal='Times New Roman', bold='Times New Roman')

def create_user_guide():
    """Generate the EnvironmentGPT User Guide PDF"""

    output_path = '/home/z/my-project/download/EnvironmentGPT_User_Guide.pdf'

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=72,
        leftMargin=72,
        topMargin=72,
        bottomMargin=72,
        title='EnvironmentGPT User Guide',
        author='Z.ai',
        creator='Z.ai',
        subject='Comprehensive guide for using EnvironmentGPT platform'
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        name='CustomTitle',
        fontName='Times New Roman',
        fontSize=28,
        leading=34,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#1F4E79'),
        spaceAfter=30
    )

    heading1_style = ParagraphStyle(
        name='CustomHeading1',
        fontName='Times New Roman',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#1F4E79'),
        spaceBefore=20,
        spaceAfter=12
    )

    heading2_style = ParagraphStyle(
        name='CustomHeading2',
        fontName='Times New Roman',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#2E75B6'),
        spaceBefore=15,
        spaceAfter=8
    )

    body_style = ParagraphStyle(
        name='CustomBody',
        fontName='Times New Roman',
        fontSize=11,
        leading=16,
        alignment=TA_JUSTIFY,
        spaceAfter=8
    )

    bullet_style = ParagraphStyle(
        name='BulletStyle',
        fontName='Times New Roman',
        fontSize=11,
        leading=16,
        leftIndent=20,
        spaceAfter=4
    )

    # Build story
    story = []

    # Cover Page
    story.append(Spacer(1, 2*inch))
    story.append(Paragraph("EnvironmentGPT", title_style))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("User Guide", ParagraphStyle(
        name='Subtitle',
        fontName='Times New Roman',
        fontSize=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#2E75B6')
    )))
    story.append(Spacer(1, 0.5*inch))
    story.append(Paragraph("Environmental Protection Agency Punjab", ParagraphStyle(
        name='Organization',
        fontName='Times New Roman',
        fontSize=14,
        alignment=TA_CENTER
    )))
    story.append(Spacer(1, 0.3*inch))
    story.append(Paragraph("Version 1.0 | March 2024", ParagraphStyle(
        name='Version',
        fontName='Times New Roman',
        fontSize=12,
        alignment=TA_CENTER,
        textColor=colors.gray
    )))
    story.append(PageBreak())

    # Table of Contents
    story.append(Paragraph("<b>Table of Contents</b>", heading1_style))
    story.append(Spacer(1, 0.2*inch))

    toc_items = [
        ("1. Introduction", "Overview of EnvironmentGPT"),
        ("2. Getting Started", "Accessing the platform"),
        ("3. Asking Questions", "How to interact with the AI"),
        ("4. Understanding Responses", "Interpreting AI outputs"),
        ("5. Audience Types", "Different response modes"),
        ("6. Best Practices", "Tips for effective queries"),
        ("7. Troubleshooting", "Common issues and solutions"),
        ("8. Privacy & Security", "Data handling policies"),
    ]

    for num, title in toc_items:
        story.append(Paragraph(f"<b>{num}</b> - {title}", body_style))

    story.append(PageBreak())

    # Section 1: Introduction
    story.append(Paragraph("<b>1. Introduction</b>", heading1_style))
    story.append(Paragraph("""
    Welcome to EnvironmentGPT, Punjab's dedicated environmental knowledge assistant developed by the
    Environmental Protection Agency (EPA) Punjab. This innovative platform leverages cutting-edge
    artificial intelligence to provide accurate, relevant, and accessible environmental information
    to citizens, researchers, policymakers, and industry professionals across the province.
    """, body_style))

    story.append(Paragraph("<b>1.1 What is EnvironmentGPT?</b>", heading2_style))
    story.append(Paragraph("""
    EnvironmentGPT is a specialized question-answering system designed exclusively for environmental
    topics relevant to Punjab, Pakistan. Unlike generic AI assistants, EnvironmentGPT has been trained
    on curated environmental documents, regulations, research papers, and official EPA Punjab data,
    ensuring that responses are accurate, contextually appropriate, and aligned with local environmental
    standards and regulations. The system utilizes advanced RAG (Retrieval Augmented Generation)
    architecture, which means it retrieves relevant information from a verified knowledge base before
    generating responses, significantly reducing the risk of inaccurate or fabricated information.
    """, body_style))

    story.append(Paragraph("<b>1.2 Key Features</b>", heading2_style))
    features = [
        "Specialized environmental knowledge focused on Punjab's context",
        "Multi-audience response modes (General Public, Technical, Policy Maker)",
        "Source citations for transparency and verification",
        "Bilingual support (English and Urdu)",
        "Real-time query processing with high accuracy",
        "Comprehensive coverage of air quality, water resources, climate change, and more",
    ]
    for feature in features:
        story.append(Paragraph(f"• {feature}", bullet_style))

    story.append(Spacer(1, 0.3*inch))

    # Section 2: Getting Started
    story.append(Paragraph("<b>2. Getting Started</b>", heading1_style))
    story.append(Paragraph("<b>2.1 Accessing the Platform</b>", heading2_style))
    story.append(Paragraph("""
    EnvironmentGPT is accessible through a web browser at the official EPA Punjab website. The platform
    requires no registration for basic queries, though advanced features may require authentication.
    Simply navigate to the EnvironmentGPT homepage, and you will be greeted with a clean, intuitive
    chat interface ready to accept your environmental questions.
    """, body_style))

    story.append(Paragraph("<b>2.2 Interface Overview</b>", heading2_style))
    story.append(Paragraph("""
    The main interface consists of several key components designed for ease of use. At the center is
    the chat window where your conversation with EnvironmentGPT appears. Below this is the input field
    where you type your questions, along with a send button. On the right side, you will find the
    source panel that displays referenced documents when available. The top navigation includes options
    for audience selection, session management, and access to this help documentation.
    """, body_style))

    # Section 3: Asking Questions
    story.append(Paragraph("<b>3. Asking Questions</b>", heading1_style))
    story.append(Paragraph("<b>3.1 Formulating Effective Queries</b>", heading2_style))
    story.append(Paragraph("""
    To receive the most accurate and helpful responses, it is important to phrase your questions clearly
    and specifically. EnvironmentGPT performs best when queries are direct and focused on environmental
    topics within its knowledge domain. Avoid vague questions and instead provide context about what
    specific information you are seeking.
    """, body_style))

    # Good vs Bad examples table
    story.append(Paragraph("<b>3.2 Query Examples</b>", heading2_style))

    header_style = ParagraphStyle(name='TableHeader', fontName='Times New Roman', fontSize=10,
                                   textColor=colors.white, alignment=TA_CENTER)
    cell_style = ParagraphStyle(name='TableCell', fontName='Times New Roman', fontSize=10,
                                 alignment=TA_LEFT)

    examples_data = [
        [Paragraph('<b>Less Effective</b>', header_style), Paragraph('<b>More Effective</b>', header_style)],
        [Paragraph('"Tell me about pollution"', cell_style),
         Paragraph('"What are the current PM2.5 levels in Lahore and their health impacts?"', cell_style)],
        [Paragraph('"Water stuff"', cell_style),
         Paragraph('"What are the NEQS standards for drinking water quality in Pakistan?"', cell_style)],
        [Paragraph('"Is the air bad?"', cell_style),
         Paragraph('"What is the Air Quality Index in Faisalabad today and what precautions should I take?"', cell_style)],
    ]

    examples_table = Table(examples_data, colWidths=[2.5*inch, 3*inch])
    examples_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F5F5')]),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))

    story.append(examples_table)
    story.append(Spacer(1, 0.2*inch))

    # Section 4: Understanding Responses
    story.append(Paragraph("<b>4. Understanding Responses</b>", heading1_style))
    story.append(Paragraph("<b>4.1 Response Components</b>", heading2_style))
    story.append(Paragraph("""
    Each response from EnvironmentGPT includes several components designed to provide comprehensive
    and verifiable information. The main response text contains the answer to your question, generated
    based on retrieved documents from the knowledge base. Below the response, you may see confidence
    indicators that show how certain the system is about the information provided.
    """, body_style))

    story.append(Paragraph("<b>4.2 Source Citations</b>", heading2_style))
    story.append(Paragraph("""
    One of EnvironmentGPT's key features is its transparent source citation system. When the system
    retrieves information from specific documents, these sources are displayed in the source panel.
    Each source includes the document title, relevant excerpt, and a relevance score indicating how
    closely the document matches your query. Clicking on a source reveals additional details and allows
    you to explore the original context more deeply.
    """, body_style))

    story.append(Paragraph("<b>4.3 Confidence Levels</b>", heading2_style))
    story.append(Paragraph("""
    EnvironmentGPT provides confidence indicators to help you assess the reliability of responses.
    High confidence (above 80%) indicates that multiple relevant sources were found with strong
    semantic matches. Medium confidence (60-80%) suggests that relevant information was found but
    may be partial or from fewer sources. Low confidence (below 60%) indicates limited relevant
    information was available, and you may want to verify the response through additional sources.
    """, body_style))

    # Section 5: Audience Types
    story.append(Paragraph("<b>5. Audience Types</b>", heading1_style))
    story.append(Paragraph("""
    EnvironmentGPT offers three distinct response modes tailored to different user types. Selecting
    the appropriate audience type before asking your question helps the system provide responses
    in the most suitable format and technical level.
    """, body_style))

    story.append(Paragraph("<b>5.1 General Public</b>", heading2_style))
    story.append(Paragraph("""
    This mode provides responses in plain, accessible language without technical jargon. It is ideal
    for citizens seeking to understand environmental issues affecting their daily lives, health
    recommendations, and general awareness topics. Responses focus on practical information and
    actionable guidance.
    """, body_style))

    story.append(Paragraph("<b>5.2 Technical</b>", heading2_style))
    story.append(Paragraph("""
    The technical mode delivers responses with scientific terminology, quantitative data, and
    detailed methodology explanations. This mode is suited for environmental professionals,
    researchers, engineers, and students who need precise technical information including
    measurement units, regulatory thresholds, and scientific references.
    """, body_style))

    story.append(Paragraph("<b>5.3 Policy Maker</b>", heading2_style))
    story.append(Paragraph("""
    Designed for government officials and decision-makers, this mode emphasizes policy implications,
    regulatory frameworks, comparative analysis, and implementation considerations. Responses include
    references to relevant laws, policies, and administrative guidelines to support evidence-based
    decision making.
    """, body_style))

    # Section 6: Best Practices
    story.append(Paragraph("<b>6. Best Practices</b>", heading1_style))

    best_practices = [
        ("Be Specific", "Include location (city, area), timeframe, and specific parameters when relevant."),
        ("One Topic at a Time", "Focus each question on a single topic for clearer, more accurate responses."),
        ("Use Context", "Reference previous responses when asking follow-up questions to maintain conversation flow."),
        ("Verify Critical Information", "For important decisions, cross-reference responses with official EPA sources."),
        ("Provide Feedback", "Use the thumbs up/down buttons to help improve response quality over time."),
    ]

    for title, desc in best_practices:
        story.append(Paragraph(f"<b>{title}:</b> {desc}", body_style))

    # Section 7: Troubleshooting
    story.append(Paragraph("<b>7. Troubleshooting</b>", heading1_style))

    story.append(Paragraph("<b>7.1 Common Issues</b>", heading2_style))

    issues_data = [
        [Paragraph('<b>Issue</b>', header_style), Paragraph('<b>Solution</b>', header_style)],
        [Paragraph('Response seems incomplete', cell_style),
         Paragraph('Try rephrasing with more specific terms or break into smaller questions', cell_style)],
        [Paragraph('No relevant sources shown', cell_style),
         Paragraph('Your question may be outside the knowledge base scope. Try alternative phrasing', cell_style)],
        [Paragraph('Slow response time', cell_style),
         Paragraph('System may be under heavy load. Wait a moment and retry', cell_style)],
        [Paragraph('Error message appears', cell_style),
         Paragraph('Refresh the page and try again. If persistent, contact EPA support', cell_style)],
    ]

    issues_table = Table(issues_data, colWidths=[2*inch, 3.5*inch])
    issues_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1F4E79')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))

    story.append(issues_table)
    story.append(Spacer(1, 0.2*inch))

    # Section 8: Privacy & Security
    story.append(Paragraph("<b>8. Privacy & Security</b>", heading1_style))
    story.append(Paragraph("""
    EnvironmentGPT is committed to protecting user privacy and maintaining data security. All
    conversations are processed securely, and personal information is not stored beyond the
    current session unless explicitly saved by the user. Query data may be anonymized and
    aggregated for system improvement purposes.
    """, body_style))

    story.append(Paragraph("<b>8.1 Data Handling</b>", heading2_style))
    story.append(Paragraph("""
    Queries submitted to EnvironmentGPT are processed in real-time and are not permanently stored
    on external servers. Session data is retained temporarily to enable conversation continuity
    and is automatically purged after a period of inactivity. Users can manually clear their
    conversation history at any time through the interface.
    """, body_style))

    story.append(Paragraph("<b>8.2 Contact & Support</b>", heading2_style))
    story.append(Paragraph("""
    For technical support, feedback, or inquiries about EnvironmentGPT, please contact the
    EPA Punjab IT department through the official channels listed on the EPA Punjab website.
    Your feedback helps us improve the system and better serve the environmental information
    needs of Punjab's citizens.
    """, body_style))

    # Build document
    doc.build(story)
    print(f"User Guide generated: {output_path}")
    return output_path

if __name__ == '__main__':
    create_user_guide()
