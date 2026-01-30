import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Loader2, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import TemplateFormFields, { TemplateField } from "@/components/TemplateFormFields";
import { DEFAULT_TEMPLATE_FIELDS } from "@/constants/ostTemplateFields";

export default function NewStudy() {
  const [, navigate] = useLocation();
  const [studyId, setStudyId] = useState<number | null>(null);
  const [studyType, setStudyType] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [userQuery, setUserQuery] = useState<string>("");
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Get study ID and type from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const type = params.get("type");
    if (id) {
      setStudyId(parseInt(id));
    } else {
      toast.error("ID исследования не найдено");
      navigate("/");
    }
    if (type) {
      setStudyType(type);
    }
  }, [navigate]);

  // Fetch study data to get type if not in URL
  useEffect(() => {
    const fetchStudy = async () => {
      if (studyId && !studyType) {
        try {
          const study = await api.studies.get(studyId);
          setStudyType(study.studyType);
        } catch (error) {
          console.error("Failed to fetch study:", error);
        }
      }
    };
    fetchStudy();
  }, [studyId, studyType]);

  // Initialize template fields for template_form type
  useEffect(() => {
    if (studyType === "template_form" && templateFields.length === 0) {
      const params = new URLSearchParams(window.location.search);
      const templateId = params.get("templateId");
      
      // For now, only ost_macular template is available
      // In future, can load different templates based on templateId
      if (!templateId || templateId === "ost_macular") {
        // Initialize with default template fields from the protocol
        setTemplateFields([...DEFAULT_TEMPLATE_FIELDS]);
      }
    }
  }, [studyType, templateFields.length]);

  const handleFileSelect = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const urls: string[] = [];

    for (const file of fileArray) {
      if (!file.type.startsWith("image/")) {
        toast.error(`Файл ${file.name} не является изображением`);
        continue;
      }

      if (file.size > 16 * 1024 * 1024) {
        toast.error(`Файл ${file.name} превышает 16 МБ`);
        continue;
      }

      validFiles.push(file);
      urls.push(URL.createObjectURL(file));
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setPreviewUrls(prev => [...prev, ...urls]);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(prev => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
    setPreviewUrls(prev => {
      const newUrls = [...prev];
      URL.revokeObjectURL(newUrls[index]);
      newUrls.splice(index, 1);
      return newUrls;
    });
  };

  const handleUploadAndAnalyze = async () => {
    if (selectedFiles.length === 0 || !studyId) return;

    setIsUploading(true);

    try {
      // Upload all images
      const uploadPromises = selectedFiles.map(file => {
        return new Promise<void>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          
          reader.onload = async () => {
            const base64 = reader.result as string;
            try {
              await api.studies.uploadImage(studyId, {
                imageData: base64,
                filename: file.name,
                mimeType: file.type,
              });
              resolve();
            } catch (error) {
              reject(error);
            }
          };
          
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        });
      });

      await Promise.all(uploadPromises);
      toast.success(`Загружено изображений: ${selectedFiles.length}`);
      setIsUploading(false);
      setIsAnalyzing(true);

      // Start analysis with optional user query or template
      try {
        if (studyType === "template_form") {
            // Filter only included fields and prepare template
            const includedFields = templateFields
              .filter((f) => f.included && f.name.trim())
              .map((f) => ({
                name: f.name.trim(),
                value: f.value.trim(),
                included: true,
                section: f.section || "",
              }));
            
            // Debug: log fields being sent
            console.log("[NewStudy] Sending fields to analyze:", includedFields.length);
            console.log("[NewStudy] Sample fields with sections:", includedFields.slice(0, 5).map(f => ({ name: f.name, section: f.section })));
            console.log("[NewStudy] Fields with structure section:", includedFields.filter(f => f.section === "structure").length);
            console.log("[NewStudy] Fields with conclusion section:", includedFields.filter(f => f.section === "conclusion").length);
            
            if (includedFields.length === 0) {
              toast.error("Добавьте хотя бы одно поле с названием");
              setIsUploading(false);
              setIsAnalyzing(false);
              return;
            }

            const analyzeResult = await api.studies.analyze(studyId, undefined, includedFields);
            
            // If result is structured JSON with fields, update templateFields with aiValue
            if (analyzeResult.analysisResult) {
              try {
                const result = typeof analyzeResult.analysisResult === 'string' 
                  ? JSON.parse(analyzeResult.analysisResult)
                  : analyzeResult.analysisResult;
                
                if (result && result.fields && Array.isArray(result.fields)) {
                  // Update templateFields with aiValue from AI response
                  setTemplateFields(prevFields => {
                    return prevFields.map(field => {
                      // Find matching AI field by name (normalized)
                      const normalizedName = field.name.trim().toLowerCase();
                      const aiField = result.fields.find((af: any) => 
                        af.name && af.name.trim().toLowerCase() === normalizedName
                      );
                      
                      if (aiField && aiField.aiValue && 
                          (field.section === 'structure' || field.section === 'conclusion')) {
                        return { ...field, aiValue: aiField.aiValue };
                      }
                      return field;
                    });
                  });
                }
              } catch (e) {
                console.warn('Failed to parse structured result, continuing with old format:', e);
                // Continue anyway - old format or parse error, user will see text result
              }
            }
          } else {
            await api.studies.analyze(studyId, userQuery.trim() || undefined);
          }

        toast.success("Анализ завершен!");
        setIsAnalyzing(false);

        // Navigate to study view
        navigate(`/study/${studyId}`);
      } catch (error: any) {
        setIsAnalyzing(false);
        toast.error(error.message || "Ошибка при анализе изображения");
      }
    } catch (error: any) {
      setIsUploading(false);
      setIsAnalyzing(false);
      toast.error(error.message || "Ошибка при загрузке изображений");
    }
  };

  const isProcessing = isUploading || isAnalyzing;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Загрузка снимка</h1>
              <p className="text-sm text-muted-foreground">Загрузите рентгеновский снимок для анализа</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Загрузка изображения</CardTitle>
            <CardDescription>
              Перетащите файл в область ниже или выберите файл с устройства
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload Area */}
            {selectedFiles.length === 0 ? (
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-primary/10 p-6 rounded-full">
                    <Upload className="h-12 w-12 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-medium mb-2">
                      Перетащите изображения сюда
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      или
                    </p>
                    <label htmlFor="file-input">
                      <Button variant="outline" asChild>
                        <span className="cursor-pointer">
                          <ImageIcon className="h-4 w-4 mr-2" />
                          Выбрать файлы
                        </span>
                      </Button>
                    </label>
                    <input
                      id="file-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Поддерживаемые форматы: JPG, PNG, DICOM. Максимальный размер файла: 16 МБ. Можно загрузить несколько изображений.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Preview Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative rounded-lg overflow-hidden border bg-black/5">
                      <img
                        src={previewUrls[index]}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-auto max-h-96 object-contain mx-auto"
                      />
                      <div className="absolute top-2 right-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveFile(index)}
                          className="h-8 w-8 p-0"
                        >
                          ×
                        </Button>
                      </div>
                      <div className="p-2 bg-accent/50">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024 / 1024).toFixed(2)} МБ
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add More Files */}
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <p className="text-sm text-muted-foreground">
                    Выбрано изображений: {selectedFiles.length}
                  </p>
                  <label htmlFor="file-input-more">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <span className="cursor-pointer">
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Добавить еще
                      </span>
                    </Button>
                  </label>
                  <input
                    id="file-input-more"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                </div>
              </div>
            )}
          </div>
          
          {selectedFiles.length > 0 && (
            <Button
              variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                    disabled={isProcessing}
                  >
                    Изменить
                  </Button>
                </div>

                {/* User Query Input (only for free_query) */}
                {studyType === "free_query" && (
                  <div className="space-y-2">
                    <Label htmlFor="user-query">Ваш вопрос к ИИ</Label>
                    <Textarea
                      id="user-query"
                      placeholder="Например: Что вы видите на этом снимке? Есть ли какие-либо патологии?"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Опишите, что именно вы хотите узнать о загруженном изображении
                    </p>
                  </div>
                )}

                {/* Template Form Fields (only for template_form) */}
                {studyType === "template_form" && (
                  <div className="space-y-4 border-t pt-4">
                    <TemplateFormFields
                      fields={templateFields}
                      onChange={setTemplateFields}
                    />
                  </div>
                )}

                {/* Analyze Button */}
                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/")}
                    disabled={isProcessing}
                  >
                    Отмена
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleUploadAndAnalyze}
                    disabled={
                      isProcessing ||
                      (studyType === "free_query" && !userQuery.trim()) ||
                      (studyType === "template_form" &&
                        templateFields.filter((f) => f.included && f.name.trim()).length === 0)
                    }
                    className="min-w-40"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Загрузка...
                      </>
                    ) : isAnalyzing ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Анализ...
                      </>
                    ) : (
                      "Исследовать"
                    )}
                  </Button>
                </div>

                {/* Progress Info */}
                {isProcessing && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900 font-medium mb-1">
                      {isUploading && "Загрузка изображения на сервер..."}
                      {isAnalyzing && "Анализ изображения с помощью ИИ..."}
                    </p>
                    <p className="text-xs text-blue-700">
                      Это может занять несколько секунд. Пожалуйста, не закрывайте страницу.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
