"""OpenAI image analysis"""
from typing import Literal, Optional, List, Any
import json
import re
from server._core.llm import invoke_llm, Message

StudyType = Literal[
    "retinal_scan", 
    "optic_nerve", 
    "macular_analysis", 
    "free_query", 
    "template_form",
    "ultrasound_thyroid",
    "ultrasound_liver",
    "lab_blood"
]

STUDY_TYPE_PROMPTS = {
    "retinal_scan": """Вы - опытный офтальмолог, специализирующийся на анализе рентгеновских снимков сетчатки глаза.
Проанализируйте предоставленный снимок сетчатки и предоставьте детальное медицинское заключение.

Структура заключения должна включать:
1. Общее описание снимка
2. Выявленные патологии или отклонения
3. Состояние сосудов сетчатки
4. Оценка макулярной области
5. Рекомендации для дальнейшего обследования или лечения

Используйте медицинскую терминологию и будьте максимально точны в описании.""",
    
    "optic_nerve": """Вы - опытный офтальмолог, специализирующийся на анализе зрительного нерва.
Проанализируйте предоставленный снимок зрительного нерва и предоставьте детальное медицинское заключение.

Структура заключения должна включать:
1. Оценка диска зрительного нерва
2. Состояние нейроретинального ободка
3. Соотношение экскавации и диска (C/D ratio)
4. Выявленные патологии (глаукома, атрофия и т.д.)
5. Рекомендации для дальнейшего обследования или лечения

Используйте медицинскую терминологию и будьте максимально точны в описании.""",
    
    "macular_analysis": """Вы - опытный офтальмолог, специализирующийся на анализе макулярной области.
Проанализируйте предоставленный снимок макулярной области и предоставьте детальное медицинское заключение.

Структура заключения должна включать:
1. Состояние фовеальной области
2. Наличие друз или пигментных изменений
3. Признаки макулярной дегенерации
4. Оценка толщины сетчатки в макулярной зоне
5. Рекомендации для дальнейшего обследования или лечения

Используйте медицинскую терминологию и будьте максимально точны в описании.""",
    
    "ultrasound_thyroid": """Вы - опытный врач-диагност, специализирующийся на ультразвуковой диагностике щитовидной железы.
Проанализируйте предоставленное УЗИ-изображение щитовидной железы и предоставьте детальное медицинское заключение.

Структура заключения должна включать:
1. Размеры и объем щитовидной железы
2. Эхогенность и структура паренхимы
3. Наличие узловых образований (размер, локализация, эхогенность)
4. Состояние регионарных лимфоузлов
5. Кровоток (при наличии допплерографии)
6. Выявленные патологии
7. Рекомендации для дальнейшего обследования или лечения

Используйте медицинскую терминологию и будьте максимально точны в описании.""",
    
    "ultrasound_liver": """Вы - опытный врач-диагност, специализирующийся на ультразвуковой диагностике печени.
Проанализируйте предоставленное УЗИ-изображение печени и предоставьте детальное медицинское заключение.

Структура заключения должна включать:
1. Размеры печени
2. Эхогенность и структура паренхимы
3. Контуры печени
4. Наличие очаговых образований (кисты, гемангиомы, опухоли и т.д.)
5. Состояние внутрипеченочных протоков и сосудов
6. Состояние желчного пузыря (если визуализируется)
7. Выявленные патологии
8. Рекомендации для дальнейшего обследования или лечения

Используйте медицинскую терминологию и будьте максимально точны в описании.""",
    
    "lab_blood": """Вы - опытный врач-лаборант, специализирующийся на анализе результатов лабораторных исследований крови.
Проанализируйте предоставленные результаты анализов крови и предоставьте детальное медицинское заключение.

Структура заключения должна включать:
1. Общий анализ крови (если представлен)
2. Биохимические показатели
3. Выявленные отклонения от нормы
4. Интерпретация результатов
5. Возможные причины отклонений
6. Рекомендации для дальнейшего обследования или лечения

Используйте медицинскую терминологию и будьте максимально точны в описании.""",
}


async def analyze_xray_image(image_urls: List[str], study_type: StudyType, user_query: Optional[str] = None) -> str:
    """Analyze X-ray image using LLM"""
    # For free_query, use a general medical prompt
    if study_type == "free_query":
        system_prompt = """Вы - опытный врач-диагност, специализирующийся на анализе медицинских изображений.
Проанализируйте предоставленное изображение и ответьте на вопрос пользователя максимально подробно и профессионально.
Используйте медицинскую терминологию и будьте точны в описании."""
    else:
        system_prompt = STUDY_TYPE_PROMPTS[study_type]
    
    # Ensure image_urls is a list
    if isinstance(image_urls, str):
        image_urls = [image_urls]
    
    print(f"[Analyze] Starting analysis for study_type={study_type}, images={len(image_urls)}, user_query={bool(user_query)}")
    
    try:
        # Prepare user message text
        if user_query:
            user_text = user_query
        else:
            if len(image_urls) > 1:
                user_text = f"Пожалуйста, проанализируйте эти {len(image_urls)} рентгеновских снимка глаза и предоставьте детальное медицинское заключение. Учтите все изображения при анализе."
            else:
                user_text = "Пожалуйста, проанализируйте этот рентгеновский снимок глаза и предоставьте детальное медицинское заключение."
        
        # Build content array with text and all images
        content: List[Any] = [
            {
                "type": "text",
                "text": user_text,
            }
        ]
        
        # Add all images
        for image_url in image_urls:
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": image_url,
                    "detail": "high",
                },
            })
        
        messages: List[Message] = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": content,
            },
        ]
        
        print(f"[Analyze] Calling invoke_llm with {len(messages)} messages")
        response = await invoke_llm(messages)
        print(f"[Analyze] Received response from LLM")
        
        analysis_result = response.get("choices", [{}])[0].get("message", {}).get("content")
        
        if not analysis_result or not isinstance(analysis_result, str):
            raise ValueError("No analysis result received from AI")
        
        print(f"[Analyze] Analysis completed, result length={len(analysis_result)}")
        return analysis_result
    except Exception as error:
        print(f"[Analyze] Error analyzing image: {type(error).__name__}: {error}")
        import traceback
        print(f"[Analyze] Traceback: {traceback.format_exc()}")
        raise ValueError(f"Failed to analyze image with AI: {error}")


async def analyze_template_form(image_urls: List[str], template: List[dict]) -> dict:
    """Analyze images and fill template form using LLM. Returns structured JSON with fields and text."""
    # Ensure image_urls is a list
    if isinstance(image_urls, str):
        image_urls = [image_urls]
    
    print(f"[TemplateForm] Starting analysis, images={len(image_urls)}, template fields={len(template)}")
    
    # Debug: log first few fields to see what we receive
    if template:
        print(f"[TemplateForm] First field sample: {template[0]}")
        print(f"[TemplateForm] Fields with section in first 5: {[f.get('section', 'NO_SECTION') for f in template[:5]]}")
    
    try:
        # Convert Pydantic models to dicts if needed
        template_dicts = []
        for field in template:
            if hasattr(field, 'dict'):
                # Pydantic model
                template_dicts.append(field.dict())
            elif hasattr(field, '__dict__'):
                # Object with __dict__
                template_dicts.append(field.__dict__)
            else:
                # Already a dict
                template_dicts.append(field)
        
        # Debug: log after conversion
        if template_dicts:
            print(f"[TemplateForm] After conversion, first field: {template_dicts[0]}")
            print(f"[TemplateForm] After conversion, sections in first 5: {[f.get('section', 'NO_SECTION') for f in template_dicts[:5]]}")
        
        # Filter only included fields
        included_fields = [f for f in template_dicts if f.get("included", True)]
        
        if not included_fields:
            raise ValueError("No included fields in template")
        
        # Separate fields by section: only "structure" and "conclusion" should be filled by AI
        ai_fields = []  # Fields that AI should fill (structure and conclusion)
        input_fields = []  # Fields that doctor fills (input section)
        
        print(f"[TemplateForm] Processing {len(included_fields)} included fields")
        
        for field in included_fields:
            field_name = field.get("name", "").strip()
            field_section = field.get("section", "").strip()
            field_value = field.get("value", "").strip()
            
            print(f"[TemplateForm] Field: name='{field_name}', section='{field_section}', value='{field_value[:50] if field_value else 'empty'}'")
            
            if field_name:
                field_info = {
                    "name": field_name,
                    "value": field_value if field_value else None,
                    "filled": bool(field_value),
                    "section": field_section
                }
                
                # AI should only fill fields from "structure" and "conclusion" sections
                if field_section in ("structure", "conclusion"):
                    print(f"[TemplateForm] Adding to ai_fields: {field_name}")
                    ai_fields.append(field_info)
                else:
                    print(f"[TemplateForm] Adding to input_fields (section='{field_section}'): {field_name}")
                    input_fields.append(field_info)
            else:
                print(f"[TemplateForm] Skipping field with empty name")
        
        print(f"[TemplateForm] Total ai_fields: {len(ai_fields)}, input_fields: {len(input_fields)}")
        
        # Build template structure for prompt - only AI fields
        template_structure = []
        for field in ai_fields:
            template_structure.append({
                "name": field["name"],
                "value": field["value"],  # None means empty, needs to be filled
                "filled": field["filled"],
                "section": field["section"]
            })
        
        # If no AI fields to fill, return empty result
        if not template_structure:
            print(f"[TemplateForm] No AI fields to fill - ai_fields={len(ai_fields)}, input_fields={len(input_fields)}")
            print(f"[TemplateForm] Sample field sections: {[f.get('section', 'NO_SECTION') for f in included_fields[:5]]}")
            return {
                "fields": [],
                "text": "### Протокол сопровождения ОСТ-снимка (макулярная область / задний полюс)\n\nВсе поля уже заполнены врачом или не требуют заполнения ИИ."
            }
        
        # Create system prompt with exact field names
        field_names_list = [f['name'] for f in template_structure if not f['filled']]
        if not field_names_list:
            print("[TemplateForm] All AI fields are already filled")
            return {
                "fields": [{"name": f["name"], "aiValue": None, "section": f.get("section", "")} for f in template_structure],
                "text": "### Протокол сопровождения ОСТ-снимка (макулярная область / задний полюс)\n\nВсе поля уже заполнены."
            }
        
        field_names_json = json.dumps(field_names_list, ensure_ascii=False, indent=2)
        
        system_prompt = f"""Вы - опытный врач-диагност, специализирующийся на анализе медицинских изображений.
Ваша задача - заполнить форму по шаблону на основе анализа предоставленного изображения.

ВАЖНО:
1. Заполненные поля (где указано значение) НЕ изменяйте - оставьте их значения как есть
2. Заполните только пустые поля (где значение null) из секций "Описание структуры сетчатки" и "Заключение"
3. Используйте ТОЧНЫЕ названия полей из списка ниже - не изменяйте их!
4. Верните результат ТОЛЬКО в формате JSON, без дополнительного текста
5. JSON должен содержать только те поля, которые нужно заполнить (пустые поля)
6. Используйте медицинскую терминологию и будьте точны в описании

Список полей для заполнения (используйте ТОЧНО эти названия):
{field_names_json}

Формат ответа: {{"точное_название_поля": "заполненное_значение", ...}}"""
        
        # Create user prompt with template structure
        template_json = json.dumps(template_structure, ensure_ascii=False, indent=2)
        image_text = "изображение" if len(image_urls) == 1 else f"{len(image_urls)} изображения"
        user_text = f"""Проанализируйте предоставленное медицинское {image_text} и заполните форму по следующему шаблону:

{template_json}

Заполненные поля (где указано значение) не изменяйте. Заполните только пустые поля (где значение null) из секций "structure" и "conclusion".
Используйте ТОЧНЫЕ названия полей из шаблона. Верните результат в формате JSON с заполненными значениями для пустых полей.
{"Учтите все изображения при анализе." if len(image_urls) > 1 else ""}"""
        
        # Build content array with text and all images
        content: List[Any] = [
            {
                "type": "text",
                "text": user_text,
            }
        ]
        
        # Add all images
        for image_url in image_urls:
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": image_url,
                    "detail": "high",
                },
            })
        
        messages: List[Message] = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": content,
            },
        ]
        
        print(f"[TemplateForm] Calling invoke_llm with {len(messages)} messages")
        response = await invoke_llm(messages)
        print(f"[TemplateForm] Received response from LLM")
        
        ai_response = response.get("choices", [{}])[0].get("message", {}).get("content")
        
        if not ai_response or not isinstance(ai_response, str):
            raise ValueError("No response received from AI")
        
        # Parse JSON response
        try:
            # Try to extract JSON from response (in case there's extra text)
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', ai_response, re.DOTALL)
            if json_match:
                filled_fields = json.loads(json_match.group())
            else:
                filled_fields = json.loads(ai_response)
        except json.JSONDecodeError as e:
            print(f"[TemplateForm] Failed to parse JSON: {e}")
            print(f"[TemplateForm] Response was: {ai_response[:500]}")
            raise ValueError(f"Failed to parse AI response as JSON: {e}")
        
        # Build structured result: merge AI-filled fields with original template
        # Create result fields array with aiValue for structure/conclusion fields
        result_ai_fields = []
        
        # Process AI fields (structure and conclusion sections)
        for field in template_structure:
            field_name = field["name"]
            field_section = field.get("section", "")
            original_value = field["value"]
            
            # If field was already filled by doctor, keep original value
            if field["filled"]:
                result_ai_fields.append({
                    "name": field_name,
                    "aiValue": None,  # Doctor already filled it
                    "section": field_section
                })
            # If field was empty and AI filled it, use AI value
            elif field_name in filled_fields:
                ai_value = filled_fields[field_name]
                # Convert to string if needed, limit length
                if isinstance(ai_value, (list, dict)):
                    ai_value = json.dumps(ai_value, ensure_ascii=False)
                elif not isinstance(ai_value, str):
                    ai_value = str(ai_value)
                # Limit length to 5000 characters
                if len(ai_value) > 5000:
                    ai_value = ai_value[:5000] + "..."
                
                result_ai_fields.append({
                    "name": field_name,
                    "aiValue": ai_value,
                    "section": field_section
                })
            # If field was empty and AI didn't fill it, leave empty
            else:
                result_ai_fields.append({
                    "name": field_name,
                    "aiValue": None,
                    "section": field_section
                })
        
        # Format result as structured template (протокол) for text display/PDF
        result_lines = []
        result_lines.append("### Протокол сопровождения ОСТ-снимка (макулярная область / задний полюс)\n")
        
        # Combine all fields (input + AI fields) for text output
        all_fields = input_fields + [
            {
                "name": f["name"],
                "value": f.get("aiValue") or f.get("value") or "(не заполнено)",
                "filled_by_ai": f.get("aiValue") is not None
            }
            for f in result_ai_fields
        ]
        
        # Group fields by sections (based on field names and sections)
        section_i = []
        section_ii = []
        section_iii = []
        section_iv = []
        other_fields = []
        
        for field in all_fields:
            name = field['name']
            value = field.get('value', '') or '(не заполнено)'
            marker = "✓" if field.get("filled_by_ai") else ""
            
            field_line = f"{marker} {name}: {value}"
            
            # Categorize by section based on field names
            if any(keyword in name.lower() for keyword in ['модель', 'режим', 'область сканирования', 'количество срезов', 'усреднение', 'индекс качества', 'артефакт', 'номер центрального', 'толщина сетчатки', 'etdrs', 'сторона глаза', 'фокус', 'контакт линзы', 'технические особенности']):
                section_i.append(field_line)
            elif any(keyword in name.lower() for keyword in ['оптические среды', 'фовеальная', 'субретинальная', 'внутрисетчаточная', 'отслойка', 'слоистость', 'пигментный эпителий', 'гиалоидная', 'структурные особенности']):
                section_ii.append(field_line)
            elif any(keyword in name.lower() for keyword in ['профиль макулы', 'характер жидкости', 'описание жидкости', 'витреомакулярный', 'состояние rpe', 'толщинный паттерн', 'паттерн заболевания']):
                section_iii.append(field_line)
            elif any(keyword in name.lower() for keyword in ['ост-признаки', 'интерпретация', 'заключение', 'динамическое наблюдение', 'сопоставление', 'консультация', 'рекомендации']):
                section_iv.append(field_line)
            else:
                other_fields.append(field_line)
        
        # Format sections
        if section_i:
            result_lines.append("\nI. Техническая часть\n")
            result_lines.extend([f"  {line}" for line in section_i])
        
        if section_ii:
            result_lines.append("\nII. Описание структуры сетчатки (по ОСТ)\n")
            result_lines.extend([f"  {line}" for line in section_ii])
        
        if section_iii:
            result_lines.append("\nIII. Анализ паттернов (оценка по ОСТ)\n")
            result_lines.extend([f"  {line}" for line in section_iii])
        
        if section_iv:
            result_lines.append("\nIV. Заключение\n")
            result_lines.extend([f"  {line}" for line in section_iv])
        
        if other_fields:
            result_lines.append("\nПрочие поля\n")
            result_lines.extend([f"  {line}" for line in other_fields])
        
        result_text = "\n".join(result_lines)
        
        # Return structured JSON object
        filled_count = sum(1 for f in result_ai_fields if f.get("aiValue") is not None)
        print(f"[TemplateForm] Analysis completed, filled {filled_count} fields by AI")
        
        return {
            "fields": result_ai_fields,
            "text": result_text
        }
        
    except Exception as error:
        print(f"[TemplateForm] Error analyzing template form: {type(error).__name__}: {error}")
        import traceback
        print(f"[TemplateForm] Traceback: {traceback.format_exc()}")
        raise ValueError(f"Failed to analyze template form with AI: {error}")

